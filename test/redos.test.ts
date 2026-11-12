/**
 * ReDoS & Large Input Boundary Test Suite (SEC-07)
 * Checks bounded processing of large inputs and preservation of a known SQLi signal.
 */
import { analyzeSourceCodeContextAware } from '../src/engine/contextAnalyzer';

let passCount = 0;
let failCount = 0;
function assert(description: string, condition: boolean) {
  if (condition) { console.log(`[✓ PASS] ${description}`); passCount++; }
  else { console.error(`[✗ FAIL] ${description}`); failCount++; }
}

const start8k = Date.now();
const input8k = 'SELECT '.repeat(8000) + 'A';
analyzeSourceCodeContextAware(input8k, 'test_8k.sql');
const duration8k = Date.now() - start8k;
assert(`8,000 repeated SELECT tokens completed in ${duration8k}ms (< 500ms budget)`, duration8k < 500);

const start16k = Date.now();
const input16k = 'SELECT '.repeat(16000) + 'A';
analyzeSourceCodeContextAware(input16k, 'test_16k.sql');
const duration16k = Date.now() - start16k;
assert(`16,000 repeated SELECT tokens completed in ${duration16k}ms (< 800ms budget)`, duration16k < 800);

const start800kb = Date.now();
const input800kb = 'SELECT ' + 'A'.repeat(800 * 1024);
analyzeSourceCodeContextAware(input800kb, 'large_line.js');
const duration800kb = Date.now() - start800kb;
assert(`800 KB single-line input completed in ${duration800kb}ms (< 500ms budget)`, duration800kb < 500);

const sqliCode = `
def get_user(req):
    user_id = req.args.get("id")
    query = "SELECT * FROM users WHERE id = " + user_id
    cursor.execute(query)
`;
const sqliResult = analyzeSourceCodeContextAware(sqliCode, 'user.py');
const hasSqlFinding = sqliResult.findings.some(f => f.cwe.includes('CWE-89') && f.verificationStatus !== 'FALSE_POSITIVE');
assert('Genuine SQL injection is still detected after input bounding', hasSqlFinding);

if (failCount > 0) process.exit(1);
console.log(`ReDoS regression suite: ${passCount}/4 passed.`);
