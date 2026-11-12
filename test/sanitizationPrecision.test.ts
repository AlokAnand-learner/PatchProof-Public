import assert from 'node:assert/strict';
import { isVulnerabilitySanitized, analyzeSourceCodeContextAware } from '../src/engine/contextAnalyzer';

const ctx = (texts: string[]) => texts.map((text, index) => ({ lineNum: index + 1, text }));

// A nearby control must never silently suppress a finding unless value-flow
// and sink coverage can be established. The current lightweight engine cannot.
const unrelatedControls: Array<[string, string, string[]]> = [
  ['CWE-89', 'db.query("SELECT * FROM users WHERE name=" + req.query.name)', ['const stmt = db.prepare("SELECT 1")']],
  ['CWE-22', 'fs.readFile(path.join(baseDir, req.query.file))', ['const safe = path.basename(otherFilename)']],
  ['CWE-79', 'res.send(`<h1>${req.query.name}</h1>`)', ['const safe = escapeHtml(otherValue)']],
  ['CWE-79', 'res.send(`<h1>${req.query.name}</h1>`)', ['const safe = DOMPurify.sanitize(otherHtml)']],
  ['CWE-79', 'res.send(`<h1>${req.query.name}</h1>`)', ['const safe = encodeURIComponent(otherValue)']],
  ['CWE-502', 'pickle.loads(request.data)', ['const parsed = JSON.parse(configText)']],
  ['CWE-502', 'pickle.loads(request.data)', ['inputFilter.setObjectInputFilter(filter)']],
  ['CWE-338', 'token = Math.random()', ['const nonce = crypto.randomBytes(32)']],
  ['CWE-79', 'res.send(`<h1>${req.query.name}</h1>`)', ['// escapeHtml(req.query.name)']],
];
for (const [rule, sink, nearby] of unrelatedControls) {
  assert.equal(isVulnerabilitySanitized(rule, sink, ctx(nearby)).isSanitized, false,
    `${rule} must not be suppressed by unrelated nearby control: ${nearby[0]}`);
}

// Even apparently relevant local patterns are not labelled safe by this
// regex-only engine: parameter binding/encoding needs semantic validation.
const plausibleControls: Array<[string, string, string[]]> = [
  ['CWE-89', 'db.query("SELECT * FROM users WHERE name=?", [name])', []],
  ['CWE-22', 'const p = path.join(baseDir, path.basename(filename))', []],
  ['CWE-502', 'yaml.safe_load(request.data)', []],
  ['CWE-338', 'token = crypto.randomBytes(32)', []],
];
for (const [rule, sink, nearby] of plausibleControls) {
  assert.equal(isVulnerabilitySanitized(rule, sink, ctx(nearby)).isSanitized, false,
    `${rule} control requires semantic verification, not heuristic auto-suppression`);
}

// A candidate beside an unrelated encoder stays visible for manual review.
const mixed = ['function render(req, res) {', '  const safe = escapeHtml(otherValue);', '  res.send(`<h1>${req.query.name}</h1>`);', '}'].join('\n');
const result = analyzeSourceCodeContextAware(mixed, 'src/render.ts');
assert.ok(result.findings.some(f => f.cwe.startsWith('CWE-79')),
  'unrelated nearby encoding must not erase the XSS candidate');
assert.notEqual(result.findings.find(f => f.cwe.startsWith('CWE-79'))?.verificationStatus, 'FALSE_POSITIVE');

assert.equal(isVulnerabilitySanitized('CWE-79', 'res.send(`<h1>${user}</h1>`)', [{ lineNum: 1, text: 'const user = html.escape(req.query.name)' }, { lineNum: 2, text: 'res.send(`<h1>${user}</h1>`)'}]).isSanitized, true, 'same-variable HTML escaping should be recognized');
assert.equal(isVulnerabilitySanitized('CWE-79', 'res.send(`<h1>${user}</h1>`)', [{ lineNum: 1, text: 'const user = html.escape(req.query.name)' }, { lineNum: 2, text: 'user = req.query.name' }, { lineNum: 3, text: 'res.send(`<h1>${user}</h1>`)'}]).isSanitized, false, 'intervening reassignment must invalidate the sanitizer evidence');
assert.equal(isVulnerabilitySanitized('CWE-79', 'res.send(`<h1>${escapeHtml(req.query.name)}</h1>`)', ctx([])).isSanitized, true, 'direct request expression HTML escaping should be recognized');

console.log('Sanitization precision: 18 assertions passed.');

// Generic variable names must not count as taint sources. A recognized source
// must be assigned to the same variable that the sink actually consumes.
const unrelatedSqlSource = `function load(req) {
  const input = req.query.name;
  const trustedName = "internal";
  db.query("SELECT * FROM users WHERE name='" + trustedName + "'");
}`;
const unrelatedSqlResult = analyzeSourceCodeContextAware(unrelatedSqlSource, 'src/userStore.ts');
const unrelatedSqlFinding = unrelatedSqlResult.findings.find(f => f.cwe.startsWith('CWE-89'));
assert.ok(unrelatedSqlFinding, 'dynamic SQL sink should remain visible');
assert.equal(unrelatedSqlFinding?.verificationStatus, 'NEEDS_REVIEW', 'a different request-derived variable must not elevate this sink to LIKELY');

const linkedSqlSource = `function load(req) {
  const name = req.query.name;
  db.query("SELECT * FROM users WHERE name='" + name + "'");
}`;
const linkedSqlResult = analyzeSourceCodeContextAware(linkedSqlSource, 'src/userStore.ts');
assert.equal(linkedSqlResult.findings.find(f => f.cwe.startsWith('CWE-89'))?.verificationStatus, 'LIKELY', 'same-variable local source-to-sink indicator should be LIKELY, not CONFIRMED');

const reassignedSqlSource = `function load(req) {
  let name = req.query.name;
  name = "internal";
  db.query("SELECT * FROM users WHERE name='" + name + "'");
}`;
const reassignedSqlResult = analyzeSourceCodeContextAware(reassignedSqlSource, 'src/userStore.ts');
assert.equal(reassignedSqlResult.findings.find(f => f.cwe.startsWith('CWE-89'))?.verificationStatus, 'NEEDS_REVIEW', 'reassignment must invalidate the bounded taint indicator');

console.log('Source-to-sink precision: 4 additional assertions passed.');
