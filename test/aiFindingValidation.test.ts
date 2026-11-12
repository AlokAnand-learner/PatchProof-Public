import assert from 'node:assert/strict';
import { validateAIModelFindings } from '../src/engine/aiFindingValidation';

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
assert.equal(Object.hasOwn(accepted[0], 'verificationStatus'), false, 'model verification labels are not trusted');
assert.equal(validateAIModelFindings([{ ...valid, startLine: 0 }], source).length, 0);
assert.equal(validateAIModelFindings([{ ...valid, startLine: 4, endLine: 4 }], source).length, 0);
assert.equal(validateAIModelFindings([{ ...valid, startLine: 3, endLine: 2 }], source).length, 0);
assert.equal(validateAIModelFindings([{ ...valid, startLine: 1.5 }], source).length, 0);
assert.equal(validateAIModelFindings([{ ...valid, startLine: '2' }], source).length, 0);
assert.equal(validateAIModelFindings([null, 'bad', []], source).length, 0);
assert.equal(validateAIModelFindings({ findings: [valid] }, source).length, 0);
assert.equal(validateAIModelFindings(Array.from({ length: 110 }, () => valid), source).length, 100);
const bounded = validateAIModelFindings([{ ...valid, title: 'x'.repeat(500), severity: 'NUCLEAR', confidence: 'CERTAIN' }], source)[0];
assert.equal(bounded.title.length, 180);
assert.equal(bounded.severity, 'MEDIUM');
assert.equal(bounded.confidence, 'LOW');
console.log('AI finding validation tests: 12 passed');
