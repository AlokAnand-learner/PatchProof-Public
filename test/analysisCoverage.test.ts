import assert from 'node:assert/strict';
import { buildAiCoverageNotice, countFindingOrigins } from '../src/engine/analysisCoverage';
import { VulnerabilityFinding } from '../src/types/security';

const finding = (verificationType: 'STATIC_RULE_MATCH' | 'AI_HYPOTHESIS', verificationStatus: 'LIKELY' | 'NEEDS_REVIEW' | 'FALSE_POSITIVE') => ({
  id: `${verificationType}-${verificationStatus}`,
  title: 'Synthetic fixture',
  cwe: 'CWE-Other',
  owaspCategory: 'Test',
  severity: 'LOW',
  confidence: 'LOW',
  verificationStatus,
  verificationType,
  startLine: 1,
  endLine: 1,
  snippet: 'fixture',
  explanation: 'fixture',
  attackScenario: 'fixture',
  remediation: 'fixture',
  suggestedPatch: '',
  status: 'OPEN'
}) as unknown as VulnerabilityFinding;

const counts = countFindingOrigins([
  finding('STATIC_RULE_MATCH', 'LIKELY'),
  finding('AI_HYPOTHESIS', 'NEEDS_REVIEW'),
  finding('AI_HYPOTHESIS', 'LIKELY'),
  finding('STATIC_RULE_MATCH', 'FALSE_POSITIVE')
]);
assert.deepEqual(counts, { aiHypothesesCount: 2, deterministicCount: 1 });

assert.match(buildAiCoverageNotice({
  attempted: 4, completed: 3, failed: 1, truncated: 2,
  maxCharactersPerFile: 35000, skippedByBudget: 2, offlineMode: false,
  cloudConsentRequired: true, cloudConsentGranted: true
}), /3 of 4 attempted files/);
assert.match(buildAiCoverageNotice({
  attempted: 4, completed: 3, failed: 1, truncated: 2,
  maxCharactersPerFile: 35000, offlineMode: false,
  cloudConsentRequired: true, cloudConsentGranted: true
}), /2 file\(s\) were truncated/);
assert.match(buildAiCoverageNotice({
  attempted: 4, completed: 3, failed: 1, truncated: 2,
  maxCharactersPerFile: 35000, skippedByBudget: 2, offlineMode: false,
  cloudConsentRequired: true, cloudConsentGranted: true
}), /2 additional eligible file.*received static-only review/);
assert.match(buildAiCoverageNotice({
  attempted: 2, completed: 0, failed: 2, truncated: 0,
  maxCharactersPerFile: 35000, offlineMode: false,
  cloudConsentRequired: true, cloudConsentGranted: true
}), /no AI coverage is claimed/);
assert.match(buildAiCoverageNotice({
  attempted: 0, completed: 0, failed: 0, truncated: 0,
  maxCharactersPerFile: 45000, offlineMode: false,
  cloudConsentRequired: true, cloudConsentGranted: false
}), /explicit cloud consent is not enabled/);
console.log('AI coverage and finding-origin metrics: 6 assertions passed.');
