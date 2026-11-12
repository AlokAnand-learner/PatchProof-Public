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


const aliasCommandSource = `function ping(req) {
  const requestHost = req.query.host;
  const hostAlias = requestHost;
  os.popen("ping " + hostAlias);
}`;
const aliasCommandResult = analyzeSourceCodeContextAware(aliasCommandSource, 'src/networkProbe.ts');
assert.equal(aliasCommandResult.findings.find(f => f.cwe.startsWith('CWE-78'))?.verificationStatus, 'LIKELY', 'bounded alias chains should preserve command-sink taint evidence');

const aliasSsrFSource = `async function load(req) {
  const requestedUrl = req.query.url;
  const urlAlias = requestedUrl;
  await fetch(urlAlias);
}`;
const aliasSsrFResult = analyzeSourceCodeContextAware(aliasSsrFSource, 'src/remoteLoader.ts');
assert.equal(aliasSsrFResult.findings.find(f => f.cwe.startsWith('CWE-918'))?.verificationStatus, 'LIKELY', 'bounded alias chains should preserve SSRF source-to-sink evidence');

const reassignedSsrFSource = `async function load(req) {
  let requestedUrl = req.query.url;
  requestedUrl = 'https://api.example.com';
  await fetch(requestedUrl);
}`;
const reassignedSsrFResult = analyzeSourceCodeContextAware(reassignedSsrFSource, 'src/remoteLoader.ts');
assert.notEqual(reassignedSsrFResult.findings.find(f => f.cwe.startsWith('CWE-918'))?.verificationStatus, 'LIKELY', 'reassigned values must not retain stale request-source taint');

console.log('Alias propagation, reassignment, and test-context classification: 7 additional assertions passed.');


const crossFunctionSource = `function readRequest(req) {
  const url = req.query.url;
}
function loadRemote() {
  const url = "https://trusted.example/";
  fetch(url);
}`;
const crossFunctionResult = analyzeSourceCodeContextAware(crossFunctionSource, 'src/remoteLoader.ts');
assert.notEqual(
  crossFunctionResult.findings.find(f => f.cwe.startsWith('CWE-918'))?.verificationStatus,
  'LIKELY',
  'request-derived values in a different function must not taint a same-named local variable'
);

const retainedAliasSource = `function load(req) {
  const url = req.query.url;
  const urlAlias = url;
  url = "https://trusted.example/";
  fetch(urlAlias);
}`;
const retainedAliasResult = analyzeSourceCodeContextAware(retainedAliasSource, 'src/remoteLoader.ts');
assert.equal(
  retainedAliasResult.findings.find(f => f.cwe.startsWith('CWE-918'))?.verificationStatus,
  'LIKELY',
  'reassigning the original variable must not erase taint from an already-copied alias'
);
console.log('Function-scope isolation and alias value semantics: 2 additional assertions passed.');

const paddedSqlLine = `${' '.repeat(5000)}db.query("SELECT * FROM users WHERE name = " + user);`;
const paddedSqlResult = analyzeSourceCodeContextAware(paddedSqlLine, 'src/paddedQuery.ts');
assert.ok(
  paddedSqlResult.findings.some(f => f.cwe.startsWith('CWE-89')),
  'SQL sinks after a long same-line prefix must not be hidden beyond the bounded inspection window'
);
console.log('Long-line window coverage: 1 additional assertion passed.');

