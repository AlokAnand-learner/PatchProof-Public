import assert from 'node:assert/strict';
import { analyzeFileContext, isCommentOrDoc, analyzeSourceCodeContextAware } from '../src/engine/contextAnalyzer';

assert.equal(analyzeFileContext('test/handler.py').isTestFile, true);
assert.equal(analyzeFileContext('src/__tests__/handler.ts').isTestFile, true);
assert.equal(analyzeFileContext('src/handler.test.ts').isTestFile, true);
assert.equal(analyzeFileContext('src/handler_spec.go').isTestFile, true);
assert.equal(analyzeFileContext('src/fixtures/vulnerable.py').isTestFile, true);
assert.equal(analyzeFileContext('C:\\repo\\test\\handler.py').isTestFile, true);
assert.equal(analyzeFileContext('src/test_helpers/fixture.py').isTestFile, true);
assert.equal(analyzeFileContext('src/contest.py').isTestFile, false);
assert.equal(analyzeFileContext('src/latest_service.ts').isTestFile, false);
assert.equal(analyzeFileContext('src/contest_handler.ts').isTestFile, false);
assert.equal(analyzeFileContext('docs/guide.md').isDemoOrDoc, true);
assert.equal(analyzeFileContext('src/README.md').isDemoOrDoc, true);
assert.equal(analyzeFileContext('src/readmeParser.ts').isDemoOrDoc, false);
assert.equal(analyzeFileContext('src/server.ts').isScannerOrTool, true);
assert.equal(analyzeFileContext('src/myserver.ts').isScannerOrTool, false);
assert.equal(analyzeFileContext('src/scanner_rules.ts').isScannerOrTool, true);
assert.equal(analyzeFileContext('src/rulebook.ts').isScannerOrTool, false);
assert.equal(analyzeFileContext('src/handler.PY').language, 'py');

assert.deepEqual(isCommentOrDoc('comment continues', true), { isComment: true, stillInMultiLine: true });
assert.deepEqual(isCommentOrDoc('*/', true), { isComment: true, stillInMultiLine: false });
assert.deepEqual(isCommentOrDoc('*/ os.popen(command)', true), { isComment: false, stillInMultiLine: false });
assert.deepEqual(isCommentOrDoc('*/ // os.popen(command)', true), { isComment: true, stillInMultiLine: false });

const mixedCommentAndSink = `/* explanatory comment
*/ os.popen("ping " + target_host)`;
const mixedResult = analyzeSourceCodeContextAware(mixedCommentAndSink, 'src/network_tool.py');
assert.ok(mixedResult.findings.some(finding => finding.cwe.startsWith('CWE-78')));
assert.equal(mixedResult.findings.find(finding => finding.cwe.startsWith('CWE-78'))?.verificationStatus, 'NEEDS_REVIEW');
assert.equal(mixedResult.findings.find(finding => finding.cwe.startsWith('CWE-78'))?.verificationType, 'STATIC_RULE_MATCH');
assert.equal(mixedResult.findings.find(finding => finding.cwe.startsWith('CWE-78'))?.patchVerificationStatus, 'UNVERIFIED_REVIEW_REQUIRED');
console.log('Context analyzer context: 26 assertions passed.');

const aliasSqlSource = `function load(req) {
  const original = req.query.name;
  const alias = original;
  const secondAlias = alias;
  db.query("SELECT * FROM users WHERE name='" + secondAlias + "'");
}`;
const aliasSqlResult = analyzeSourceCodeContextAware(aliasSqlSource, 'src/userStore.ts');
assert.equal(aliasSqlResult.findings.find(f => f.cwe.startsWith('CWE-89'))?.verificationStatus, 'LIKELY', 'simple identifier alias chains should preserve bounded taint evidence');

const reassignedAliasSqlSource = `function load(req) {
  const original = req.query.name;
  let alias = original;
  alias = "internal";
  db.query("SELECT * FROM users WHERE name='" + alias + "'");
}`;
const reassignedAliasSqlResult = analyzeSourceCodeContextAware(reassignedAliasSqlSource, 'src/userStore.ts');
assert.equal(reassignedAliasSqlResult.findings.find(f => f.cwe.startsWith('CWE-89'))?.verificationStatus, 'NEEDS_REVIEW', 'reassignment of an alias should invalidate the bounded taint indicator');

const testFixtureResult = analyzeSourceCodeContextAware(`describe("test", () => {
  const formula = req.query.formula;
  eval("const result = " + formula);
});`, 'test/evaluator.test.js');
const fixtureFinding = testFixtureResult.findings.find(f => f.cwe.startsWith('CWE-95'));
assert.equal(fixtureFinding?.verificationStatus, 'NEEDS_REVIEW', 'test fixture findings should not be classified as likely production vulnerabilities');
assert.equal(fixtureFinding?.severity, 'INFO', 'test fixture findings should not lower production security score');

console.log('Alias propagation and test-context classification: 4 additional assertions passed.');
