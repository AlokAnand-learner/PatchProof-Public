/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regression tests for privacy-safe browser review-history retention.
 */

import {
  clearScanHistory,
  getScanHistory,
  isPrivacyModeEnabled,
  saveScanToHistory,
  setPrivacyMode
} from '../src/utils/securityUtils';
import type { ScanResult } from '../src/types/security';

class MemoryStorage {
  private values = new Map<string, string>();
  failRemovals = false;

  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }

  removeItem(key: string): void {
    if (this.failRemovals) throw new Error('Synthetic storage removal failure');
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const storage = new MemoryStorage();
let historyEvents = 0;
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
Object.defineProperty(globalThis, 'window', {
  value: { dispatchEvent: () => { historyEvents += 1; return true; } },
  configurable: true
});

let passCount = 0;
let failCount = 0;
function assert(description: string, condition: boolean): void {
  if (condition) {
    console.log(`[✓ PASS] ${description}`);
    passCount += 1;
  } else {
    console.error(`[✗ FAIL] ${description}`);
    failCount += 1;
  }
}

function makeScan(id: string): ScanResult {
  return {
    id,
    projectName: 'Privacy regression fixture',
    fileName: 'sample.ts',
    language: 'typescript',
    timestamp: new Date(0).toISOString(),
    modelUsed: 'Local test fixture',
    executionTimeMs: 1,
    originalCode: 'const apiKey = "FULL_SOURCE_SECRET_123";',
    patchedFullCode: 'const apiKey = process.env.API_KEY; // FULL_PATCH_SECRET_456',
    metrics: {
      score: 90,
      grade: 'A',
      criticalCount: 0,
      highCount: 0,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
      totalFindings: 1,
      confirmedCount: 0,
      likelyCount: 1,
      needsReviewCount: 0,
      falsePositiveCount: 0,
      aiHypothesesCount: 0,
      deterministicCount: 1,
      linesAnalyzed: 1
    },
    findings: [{
      id: 'finding-1',
      title: 'Potential secret exposure',
      cwe: 'CWE-798',
      owaspCategory: 'A07:2021-Identification and Authentication Failures',
      severity: 'MEDIUM',
      confidence: 'MEDIUM',
      verificationStatus: 'LIKELY',
      verificationType: 'STATIC_RULE_MATCH',
      startLine: 1,
      endLine: 1,
      snippet: 'const apiKey = "FINDING_EVIDENCE_SECRET_999";',
      surroundingContext: 'const apiKey = "FINDING_EVIDENCE_SECRET_999";',
      explanation: 'Test finding',
      attackScenario: 'Test scenario',
      remediation: 'Use a secret manager',
      suggestedPatch: 'const apiKey = "FINDING_PATCH_SECRET_888";',
      status: 'OPEN'
    }],
    summary: 'Privacy fixture',
    recommendations: ['Use environment variables'],
    isMultiFile: true,
    files: [{
      filePath: 'src/sample.ts',
      language: 'typescript',
      content: 'const dbPassword = "FILE_SOURCE_SECRET_789";',
      patchedContent: 'const dbPassword = process.env.DB_PASSWORD; // FILE_PATCH_SECRET_012',
      lines: 1,
      size: 42
    }]
  };
}

async function run(): Promise<void> {
  assert('Privacy mode is enabled by default when no preference exists', isPrivacyModeEnabled());

  // Simulate an older installation with source-bearing history but no saved privacy preference.
  storage.setItem('patchproof_scan_history_v1', JSON.stringify([{
    id: 'legacy-scan',
    projectName: 'Legacy fixture',
    fileName: 'legacy.ts',
    language: 'typescript',
    timestamp: new Date(0).toISOString(),
    score: 90,
    grade: 'A',
    totalFindings: 1,
    criticalCount: 0,
    highCount: 0,
    scanResult: makeScan('legacy-scan')
  }]));
  const legacyHistory = getScanHistory();
  const legacyStoredJson = storage.getItem('patchproof_scan_history_v1') || '';
  assert('Legacy history is redacted automatically under the new default', !legacyStoredJson.includes('FULL_SOURCE_SECRET_123') && legacyHistory[0]?.scanResult.originalCode.includes('Redacted for privacy'));
  assert('Legacy full-file patches are removed during automatic migration', !legacyStoredJson.includes('FULL_PATCH_SECRET_456'));

  assert('Explicit source-retention opt-out can be saved', setPrivacyMode(false));
  assert('Privacy mode reports disabled only after explicit opt-out', !isPrivacyModeEnabled());

  saveScanToHistory(makeScan('scan-before-enable'));
  const rawBeforeEnable = storage.getItem('patchproof_scan_history_v1') || '';
  assert('Opted-out history retains full source by explicit user choice', rawBeforeEnable.includes('FULL_SOURCE_SECRET_123'));
  assert('Opted-out history retains full-file patch by explicit user choice', rawBeforeEnable.includes('FULL_PATCH_SECRET_456'));

  assert('Enabling privacy mode succeeds and scrubs existing history', setPrivacyMode(true));
  assert('Privacy mode remains enabled after scrubbing existing history', isPrivacyModeEnabled());
  const scrubbed = getScanHistory()[0]?.scanResult;
  assert('Existing original source is replaced with a redaction marker', scrubbed?.originalCode.includes('Redacted for privacy') === true);
  assert('Existing full-file patch is removed', scrubbed?.patchedFullCode === undefined);
  assert('Existing project file content is replaced with a redaction marker', scrubbed?.files?.[0]?.content.includes('Redacted for privacy') === true);
  assert('Existing per-file patched content is removed', scrubbed?.files?.[0]?.patchedContent === undefined);

  saveScanToHistory(makeScan('scan-after-enable'));
  const rawAfterEnable = storage.getItem('patchproof_scan_history_v1') || '';
  assert('New history does not persist full original source in privacy mode', !rawAfterEnable.includes('FULL_SOURCE_SECRET_123'));
  assert('New history does not persist full-file patches in privacy mode', !rawAfterEnable.includes('FULL_PATCH_SECRET_456'));
  assert('New history does not persist project file source in privacy mode', !rawAfterEnable.includes('FILE_SOURCE_SECRET_789'));
  assert('New history does not persist per-file patched source in privacy mode', !rawAfterEnable.includes('FILE_PATCH_SECRET_012'));
  const savedEvidenceSnippet = JSON.parse(rawAfterEnable)[0]?.scanResult?.findings?.[0]?.snippet || '';
  assert('Finding evidence remains available but likely secrets are redacted', savedEvidenceSnippet.includes('apiKey') && savedEvidenceSnippet.includes('[REDACTED]') && !rawAfterEnable.includes('FINDING_EVIDENCE_SECRET_999'));
  assert('Suggested patches in saved findings do not retain likely secrets', !rawAfterEnable.includes('FINDING_PATCH_SECRET_888'));
  assert('History update events are dispatched for privacy changes and saves', historyEvents >= 4);

  assert('Users can explicitly opt back into full-source history storage', setPrivacyMode(false));
  saveScanToHistory(makeScan('scan-after-opt-out'));
  const rawAfterOptOut = storage.getItem('patchproof_scan_history_v1') || '';
  assert('Full source is retained only after explicit opt-out', rawAfterOptOut.includes('FULL_SOURCE_SECRET_123'));

  assert('Clear history reports success after removing saved records', clearScanHistory() === true);
  assert('Clear history actually removes the persisted history key', storage.getItem('patchproof_scan_history_v1') === null);
  storage.failRemovals = true;
  const originalConsoleError = console.error;
  console.error = () => {};
  const failedClear = clearScanHistory();
  console.error = originalConsoleError;
  assert('Clear history reports failure when browser storage removal throws', failedClear === false);
  storage.failRemovals = false;

  console.log('-----------------------------------------------------------');
  console.log(`Privacy regression results: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) throw new Error('Privacy regression suite failed.');
}

run().catch(error => {
  console.error('Privacy regression suite failed unexpectedly:', error);
  throw error;
});
