import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { validateAIModelFindings, sanitizeAIText } from '../src/engine/aiFindingValidation';

const source = ['const user = input;', 'db.query(user);', 'return true;'].join('\n');
const valid = {
  title: 'Possible injection', cwe: 'CWE-89', owaspCategory: 'A05:2025-Injection',
  severity: 'HIGH', confidence: 'HIGH', startLine: 2, endLine: 2,
  snippet: 'MODEL-FABRICATED-SNIPPET', explanation: 'Potential unsafe query',
  attackScenario: 'Untrusted input may reach the query', exploitConditions: 'Input is attacker controlled',
  remediation: 'Use parameterized queries', suggestedPatch: 'db.query(sql, [user]);',
};

const accepted = validateAIModelFindings([valid], source);
assert.equal(accepted.length, 1);
assert.equal(accepted[0].startLine, 2);
assert.equal(accepted[0].endLine, 2);
assert.equal(accepted[0].snippet, 'db.query(user);', 'snippet must be derived from source, not model output');
const duplicatePair = validateAIModelFindings([
  { ...valid, title: 'Possible   injection', severity: 'HIGH' },
  { ...valid, title: ' possible injection ', severity: 'CRITICAL' },
], source);
assert.equal(duplicatePair.length, 1, 'equivalent model findings at the same location must be deduplicated');
assert.equal(duplicatePair[0].severity, 'HIGH', 'the first source-validated occurrence is retained');
assert.equal(Object.hasOwn(accepted[0], 'verificationStatus'), false, 'model verification labels are not trusted');
const hostileLabels = validateAIModelFindings([{
  ...valid,
  title: 'Alert\u202Etxt.exe',
  cwe: 'CWE-89\u202E',
  explanation: 'line one\u0000\u202Eline two\u0007',
  owaspCategory: 'A05\u202E:Injection',
}], source)[0];
assert.equal(hostileLabels.title, 'Alerttxt.exe', 'bidirectional override controls must not survive in labels');
assert.equal(hostileLabels.cwe, 'CWE-89', 'bidirectional controls are removed before validating CWE identifiers');
assert.equal(hostileLabels.explanation, 'line one line two', 'control and bidirectional formatting characters must be removed from model prose');
const normalCwe = validateAIModelFindings([{ ...valid, cwe: 'cwe-89' }], source)[0];
assert.equal(normalCwe.cwe, 'CWE-89', 'valid CWE identifiers are normalized');
assert.equal(validateAIModelFindings([{ ...valid, startLine: 0 }], source).length, 0);
assert.equal(validateAIModelFindings([{ ...valid, startLine: 4, endLine: 4 }], source).length, 0);
assert.equal(validateAIModelFindings([{ ...valid, startLine: 3, endLine: 2 }], source).length, 0);
assert.equal(validateAIModelFindings([{ ...valid, startLine: 1.5 }], source).length, 0);
assert.equal(validateAIModelFindings([{ ...valid, startLine: '2' }], source).length, 0);
assert.equal(validateAIModelFindings([null, 'bad', []], source).length, 0);
assert.equal(validateAIModelFindings({ findings: [valid] }, source).length, 0);
assert.equal(validateAIModelFindings(Array.from({ length: 110 }, () => valid), source).length, 1, 'repeated findings are deduplicated after the input cap');
const bounded = validateAIModelFindings([{ ...valid, title: 'x'.repeat(500), severity: 'NUCLEAR', confidence: 'CERTAIN' }], source)[0];
assert.equal(bounded.title.length, 180);
assert.equal(bounded.severity, 'MEDIUM');
assert.equal(bounded.confidence, 'LOW');
assert.equal(sanitizeAIText('Summary\\u202Etxt\\u0000\\u0007 hidden', 12), 'Summarytxt h', 'AI report prose removes direction controls and control characters before truncation');
assert.equal(sanitizeAIText('   ', 100), '', 'empty AI summaries remain empty rather than receiving fabricated content');
assert.equal(sanitizeAIText('x'.repeat(20), 8), 'x'.repeat(8), 'AI report prose is bounded before it reaches the UI');
console.log('AI finding validation tests: 21 passed');

const longerSource = [...source, 'const hidden = req.body.secret;', 'exec(hidden);'].join('\n');
const submittedPrefix = longerSource.split('\n').slice(0, 3).join('\n');
assert.equal(validateAIModelFindings([{ ...valid, startLine: 5, endLine: 5, snippet: 'exec(hidden);' }], submittedPrefix).length, 0,
  'AI findings outside the submitted prefix must be rejected even if they match the full file');
const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
assert.ok(serverSource.includes('validateAIModelFindings(parsed?.findings, aiInputContent)'),
  'multi-file AI findings must be validated against the submitted prefix');
console.log('AI truncation boundary: 2 assertions passed.');
