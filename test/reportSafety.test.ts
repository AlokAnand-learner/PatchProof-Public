import assert from 'node:assert/strict';
import { generateHtmlReport, generateMarkdownReport, sanitizeDownloadFilename } from '../src/utils/securityUtils';
import { ScanResult } from '../src/types/security';

const payload = '</div><script>globalThis.patchproofInjected = true</script>';
const scan = {
  id: 'synthetic-report-1', projectName: payload, fileName: payload, language: 'typescript',
  timestamp: '2026-11-12T00:00:00.000Z', modelUsed: 'Context-Aware Static Rules (Local)',
  executionTimeMs: 1, originalCode: '', summary: payload, recommendations: [payload],
  metrics: {
    score: payload as unknown as number, grade: 'A+', criticalCount: payload as unknown as number,
    highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0,
    totalFindings: payload as unknown as number, confirmedCount: 0, likelyCount: 1,
    needsReviewCount: 0, falsePositiveCount: 0, aiHypothesesCount: 0,
    deterministicCount: 1, linesAnalyzed: payload as unknown as number
  },
  findings: [{
    id: 'synthetic-finding-1', title: payload, filePath: payload, cwe: 'CWE-78',
    owaspCategory: 'A03:2021-Injection', severity: 'HIGH', confidence: 'HIGH',
    verificationStatus: 'LIKELY', verificationType: 'STATIC_RULE_MATCH',
    startLine: payload as unknown as number, endLine: payload as unknown as number,
    snippet: '<script>alert(1)</script>', explanation: payload, attackScenario: 'Synthetic test only',
    remediation: 'Use a safe API', suggestedPatch: 'const safe = true;', status: 'OPEN'
  }]
} as unknown as ScanResult;

const html = generateHtmlReport(scan);
assert.equal(html.includes('<script>'), false);
assert.equal(html.includes('</div><script>'), false);
assert.match(html, /NOT RUN \(not executed\)/);
assert.equal(html.includes('Confidence: 75%'), false);
assert.match(html, /<div class="score-val">0 /);

const markdown = generateMarkdownReport(scan);
assert.match(markdown, /Local analysis \(no remote AI transmission recorded\)/);
assert.match(markdown, /\*\*Method:\*\* STATIC_RULE_MATCH/);
assert.equal(markdown.includes('100% In-Memory Local'), false);
console.log('Report safety: 8 assertions passed.');

assert.equal(sanitizeDownloadFilename('../../reports\r\n<script>.html').includes('/'), false);
assert.equal(sanitizeDownloadFilename('../../reports\r\n<script>.html').includes('\n'), false);
assert.equal(sanitizeDownloadFilename('\\\\server\\share\\report.json').includes('\\'), false);
assert.equal(sanitizeDownloadFilename('...'), 'PatchProof-Report');
assert.equal(sanitizeDownloadFilename('x'.repeat(250)).length, 180);
console.log('Report download filename safety: 5 assertions passed.');

const suppressedScan = {
  ...scan,
  findings: [{
    ...scan.findings[0],
    verificationStatus: 'FALSE_POSITIVE',
    patchVerificationStatus: 'VERIFIED_STATIC'
  }]
} as unknown as ScanResult;
const suppressedMarkdown = generateMarkdownReport(suppressedScan);
assert.match(suppressedMarkdown, /Validation Status: \*\*NOT_APPLICABLE\*\*/);
assert.equal(suppressedMarkdown.includes('Validation Status: **VALIDATED**'), false);

const emptyScan = { ...scan, findings: [] } as unknown as ScanResult;
const emptyMarkdown = generateMarkdownReport(emptyScan);
assert.match(emptyMarkdown, /No matching vulnerability patterns were identified/);
assert.match(emptyMarkdown, /does not prove the code is vulnerability-free/);
assert.match(emptyMarkdown, /Heuristic Risk Indicator/);
console.log('Report confidence and status semantics: 5 assertions passed.');

assert.match(html, /Heuristic Risk Indicator/);
assert.match(html, /not a security guarantee/);
const emptyHtml = generateHtmlReport(emptyScan);
assert.match(emptyHtml, /No matching vulnerability patterns were identified/);
assert.match(emptyHtml, /does not prove the code is vulnerability-free/);
const noticeScan = { ...scan, analysisNotice: 'AI review was not used because cloud consent is off.' } as unknown as ScanResult;
assert.match(generateMarkdownReport(noticeScan), /Analysis Coverage.*AI review was not used/);
assert.match(generateHtmlReport(noticeScan), /Analysis Coverage:.*AI review was not used/);
console.log('HTML report confidence semantics: 6 assertions passed.');
