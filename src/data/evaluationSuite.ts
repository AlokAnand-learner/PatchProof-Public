import { EvaluationTestCase, EvaluationMetrics } from '../types/security';
import { analyzeSourceCodeContextAware } from '../engine/contextAnalyzer';

export const EVALUATION_TEST_CASES: EvaluationTestCase[] = [
  // 1. Genuine Vulnerability: SQL Injection via unparameterized string formatting
  {
    id: 'eval-sqli-genuine-01',
    title: 'Genuine SQL Injection via Dynamic String Interpolation',
    category: 'Injection',
    description: 'Direct concatenation of user request argument into SQL query.',
    fileName: 'user_service.py',
    language: 'python',
    expectedOutcome: 'VULNERABILITY',
    expectedClassification: 'LIKELY',
    expectedCwe: 'CWE-89',
    rationale: 'Direct tainted flow from request.args into SQL execution with no parameter binding.',
    code: `def get_user(request):
    username = request.args.get("username")
    cursor.execute(f"SELECT id, name FROM users WHERE username = '{username}'")
    return cursor.fetchone()`
  },

  // 2. Secure Code: Parameterized Query
  {
    id: 'eval-sqli-secure-02',
    title: 'Secure Parameterized SQL Query',
    category: 'Injection',
    description: 'Properly parameterized query using placeholder syntax.',
    fileName: 'user_service_secure.py',
    language: 'python',
    expectedOutcome: 'SECURE',
    expectedClassification: 'FALSE_POSITIVE',
    rationale: 'Parameters are safely passed to driver with placeholder binding.',
    code: `def get_user_secure(request):
    username = request.args.get("username")
    cursor.execute("SELECT id, name FROM users WHERE username = ?", (username,))
    return cursor.fetchone()`
  },

  // 3. False Positive Pattern: Scanner Detection Rule (Self-Scanning)
  {
    id: 'eval-fp-scanner-rule-03',
    title: 'Scanner Regex Detection Rule Pattern',
    category: 'False Positive Reduction',
    description: 'A static analysis regex rule that checks for deserialization patterns.',
    fileName: 'scanner_rules.ts',
    language: 'typescript',
    expectedOutcome: 'FALSE_POSITIVE_SUPPRESSED',
    expectedClassification: 'FALSE_POSITIVE',
    rationale: 'This is a detection rule (.test method), not an unsafe deserialization operation.',
    code: `export function checkDeserialization(lineText: string): boolean {
    const isDeser = /ObjectInputStream|readObject|pickle\\.loads/i.test(lineText);
    return isDeser;
}`
  },

  // 4. False Positive Pattern: Documentation / Comment with Vulnerability Keyword
  {
    id: 'eval-fp-comment-doc-04',
    title: 'Comment Explaining Insecure Deserialization Risk',
    category: 'Documentation',
    description: 'A code comment documenting the risk of ObjectInputStream.',
    fileName: 'SecurityGuidance.java',
    language: 'java',
    expectedOutcome: 'SECURE',
    expectedClassification: 'FALSE_POSITIVE',
    rationale: 'Dangerous keyword resides strictly inside a single-line or multi-line comment.',
    code: `// WARNING: Never use ObjectInputStream.readObject() directly on untrusted inputs.
// Always use secure JSON or SafeLoader.
public class SecurityGuidance {
    public void logGuidance() {
        System.out.println("Guidance verified.");
    }
}`
  },

  // 5. Genuine Vulnerability: Command Injection via os.popen
  {
    id: 'eval-cmdi-genuine-05',
    title: 'Genuine OS Command Injection',
    category: 'Command Injection',
    description: 'Untrusted user host parameter concatenated into shell invocation.',
    fileName: 'network_tool.py',
    language: 'python',
    expectedOutcome: 'VULNERABILITY',
    expectedClassification: 'LIKELY',
    expectedCwe: 'CWE-78',
    rationale: 'User-controlled host parameter passed directly into os.popen without non-shell argument arrays.',
    code: `import os
def ping_server(request):
    target_host = request.json.get("host")
    return os.popen("ping -c 2 " + target_host).read()`
  },

  // 6. Secure Code: Non-shell argument array
  {
    id: 'eval-cmdi-secure-06',
    title: 'Secure Subprocess with Argument Array (shell=False)',
    category: 'Command Injection',
    description: 'System utility invoked using safe argument array without shell interpreter.',
    fileName: 'network_tool_secure.py',
    language: 'python',
    expectedOutcome: 'SECURE',
    expectedClassification: 'FALSE_POSITIVE',
    rationale: 'subprocess.run used with explicit argument list and shell=False (default).',
    code: `import subprocess
def ping_server_secure(target_host):
    result = subprocess.run(["ping", "-c", "2", target_host], capture_output=True, check=True)
    return result.stdout`
  },

  // 7. Test Fixture: Intentionally Vulnerable Mock Function
  {
    id: 'eval-fixture-07',
    title: 'Test Fixture Demonstrating Mock Exploit Payload',
    category: 'Test Fixture',
    description: 'Unit test verifying that an evaluator throws on malicious formulas.',
    fileName: 'evaluator.test.js',
    language: 'javascript',
    expectedOutcome: 'NEEDS_REVIEW',
    expectedClassification: 'NEEDS_REVIEW',
    rationale: 'Occurs inside test file; retain as informational review evidence, not as a likely production vulnerability.',
    code: `describe("Evaluator Security Tests", () => {
    it("should catch unsafe code", () => {
        const formula = req.query.formula;
        eval("const result = " + formula);
    });
});`
  },

  // 8. Genuine Vulnerability: Insecure Deserialization via readObject
  {
    id: 'eval-deser-genuine-08',
    title: 'Genuine Insecure Java ObjectInputStream',
    category: 'Insecure Deserialization',
    description: 'Unvalidated byte stream passed to ObjectInputStream.readObject.',
    fileName: 'SessionManager.java',
    language: 'java',
    expectedOutcome: 'NEEDS_REVIEW',
    expectedClassification: 'NEEDS_REVIEW',
    expectedCwe: 'CWE-502',
    rationale: 'A generic parameter name does not prove external control; keep this dangerous deserialization sink for review until the caller/source is traced.',
    code: `public Object restoreSession(String rawPayload) throws Exception {
    byte[] data = Base64.getDecoder().decode(rawPayload);
    try (ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(data))) {
        return ois.readObject();
    }
}`
  },

  // 9. Needs Review: Dangerous Operation with Ambiguous Scope
  {
    id: 'eval-needs-review-09',
    title: 'File Read with Ambiguous Path Parameter',
    category: 'Path Traversal',
    description: 'File reading operation where parameter origin is not in immediate local scope.',
    fileName: 'reader.go',
    language: 'go',
    expectedOutcome: 'NEEDS_REVIEW',
    expectedClassification: 'NEEDS_REVIEW',
    expectedCwe: 'CWE-22',
    rationale: 'Dangerous open operation without confirmation of whether variable is caller-controlled.',
    code: `func ReadDataFile(internalConfigPath string) ([]byte, error) {
    return os.ReadFile("/var/app/data/" + internalConfigPath)
}`
  },

  // 10. False Positive: Sanitized Path with path.basename
  {
    id: 'eval-path-sanitized-10',
    title: 'Properly Sanitized Path Traversal Protection',
    category: 'Path Traversal',
    description: 'Path traversal sanitized using path.basename and path.resolve.',
    fileName: 'exportHandler.js',
    language: 'javascript',
    expectedOutcome: 'SECURE',
    expectedClassification: 'FALSE_POSITIVE',
    rationale: 'path.basename removes relative traversal dots (../) safely.',
    code: `router.get('/export', (req, res) => {
    const filename = req.query.file;
    const safeName = path.basename(filename);
    const targetPath = path.resolve(baseDir, safeName);
    res.sendFile(targetPath);
});`
  },

  // 11. Genuine Vulnerability: Reflected Cross-Site Scripting (XSS)
  {
    id: 'eval-xss-genuine-11',
    title: 'Genuine Reflected XSS in Template Response',
    category: 'XSS',
    description: 'Unescaped user input rendered directly into HTML response body.',
    fileName: 'profile_view.py',
    language: 'python',
    expectedOutcome: 'VULNERABILITY',
    expectedClassification: 'LIKELY',
    expectedCwe: 'CWE-79',
    rationale: 'Direct string interpolation of user-supplied query param into HTML template without escaping.',
    code: `from flask import request
def render_profile():
    user = request.args.get("name")
    return f"<div><h1>Welcome {user}</h1></div>"`
  },

  // 12. Secure Code: HTML Escaped Context
  {
    id: 'eval-xss-secure-12',
    title: 'Secure HTML Rendering with html.escape',
    category: 'XSS',
    description: 'User input passed through standard HTML escaping before rendering.',
    fileName: 'profile_view_secure.py',
    language: 'python',
    expectedOutcome: 'SECURE',
    expectedClassification: 'FALSE_POSITIVE',
    rationale: 'html.escape neutralizes HTML tags and attribute breakouts.',
    code: `from flask import request
import html
def render_profile_secure():
    user = html.escape(request.args.get("name", ""))
    return f"<div><h1>Welcome {user}</h1></div>"`
  },

  // 13. Genuine Vulnerability: Insecure Cryptographic PRNG for Security Token
  {
    id: 'eval-crypto-genuine-13',
    title: 'Insecure Math.random for Password Reset Token',
    category: 'Cryptography',
    description: 'Use of pseudo-random number generator for sensitive security token.',
    fileName: 'auth_helper.js',
    language: 'javascript',
    expectedOutcome: 'NEEDS_REVIEW',
    expectedClassification: 'NEEDS_REVIEW',
    expectedCwe: 'CWE-338',
    rationale: 'Math.random is cryptographically insecure and predictable for authentication tokens.',
    code: `function generateResetToken() {
    return Math.random().toString(36).substring(2);
}`
  }
  ,
  // 14. Genuine Vulnerability: Direct request input to shell command
  {
    id: 'eval-command-genuine-14',
    title: 'Direct Request Input to Shell Command',
    category: 'Command Injection',
    description: 'Request-controlled host is interpolated into shell execution.',
    fileName: 'ping_route.js',
    language: 'javascript',
    expectedOutcome: 'VULNERABILITY',
    expectedClassification: 'LIKELY',
    expectedCwe: 'CWE-78',
    rationale: 'The request query parameter is passed directly into a shell execution sink.',
    code: `function ping(req) {
  exec("ping -c 1 " + req.query.host);
}`
  },

  // 15. Genuine Vulnerability: Direct request URL to outbound HTTP client
  {
    id: 'eval-ssrf-genuine-15',
    title: 'Request-Controlled URL Passed to HTTP Client',
    category: 'SSRF',
    description: 'A client-supplied URL is fetched without an allowlist.',
    fileName: 'proxy_route.js',
    language: 'javascript',
    expectedOutcome: 'VULNERABILITY',
    expectedClassification: 'LIKELY',
    expectedCwe: 'CWE-918',
    rationale: 'The request URL reaches an outbound HTTP request sink directly.',
    code: `async function proxy(req) {
  return await axios.get(req.query.url);
}`
  },

  // 16. Review-only: Deserialization sink with unknown caller trust
  {
    id: 'eval-deserialization-review-16',
    title: 'Deserialization Sink with Unknown Input Origin',
    category: 'Deserialization',
    description: 'A serialized parameter reaches pickle.loads, but its caller is not available.',
    fileName: 'session_loader.py',
    language: 'python',
    expectedOutcome: 'NEEDS_REVIEW',
    expectedClassification: 'NEEDS_REVIEW',
    expectedCwe: 'CWE-502',
    rationale: 'Deserialization is sensitive, but this isolated file does not prove the parameter is attacker-controlled.',
    code: `def load_session(serialized):
    return pickle.loads(serialized)`
  },

  // 17. Review-only: Dynamic evaluation with unknown input origin
  {
    id: 'eval-dynamic-eval-review-17',
    title: 'Dynamic Evaluation with Unknown Input Origin',
    category: 'Code Evaluation',
    description: 'A formula parameter is evaluated, but its origin is unknown.',
    fileName: 'calculator.js',
    language: 'javascript',
    expectedOutcome: 'NEEDS_REVIEW',
    expectedClassification: 'NEEDS_REVIEW',
    expectedCwe: 'CWE-95',
    rationale: 'The eval sink is dangerous, but whole-program caller data flow is unavailable.',
    code: `function calculate(formula) {
  return eval(formula);
}`
  },

  // 18. Review-only: Path construction from a generic filename
  {
    id: 'eval-path-review-18',
    title: 'Filesystem Path Built from a Filename Parameter',
    category: 'Path Traversal',
    description: 'A filename parameter is joined to a data directory.',
    fileName: 'attachment_store.js',
    language: 'javascript',
    expectedOutcome: 'NEEDS_REVIEW',
    expectedClassification: 'NEEDS_REVIEW',
    expectedCwe: 'CWE-22',
    rationale: 'A path sink exists, but the isolated parameter is not proven to originate from an untrusted request.',
    code: `function readAttachment(filename) {
  const filePath = path.join('/var/app/data/', filename);
  return fs.readFileSync(filePath, 'utf8');
}`
  },

  // 19. Review-only: Outbound URL parameter with unknown caller trust
  {
    id: 'eval-ssrf-review-19',
    title: 'Outbound Request Uses a URL Parameter',
    category: 'SSRF',
    description: 'An HTTP client receives a URL parameter whose caller is unavailable.',
    fileName: 'remote_fetcher.js',
    language: 'javascript',
    expectedOutcome: 'NEEDS_REVIEW',
    expectedClassification: 'NEEDS_REVIEW',
    expectedCwe: 'CWE-918',
    rationale: 'The outbound request is sensitive, but this file alone cannot establish user control.',
    code: `async function fetchRemote(url) {
  return await axios.get(url);
}`
  },

  // 20. Review-only: Hardcoded credential pattern
  {
    id: 'eval-secret-review-20',
    title: 'Credential-Like Literal in Configuration',
    category: 'Secrets',
    description: 'A key-like variable contains a long literal value.',
    fileName: 'service_config.js',
    language: 'javascript',
    expectedOutcome: 'NEEDS_REVIEW',
    expectedClassification: 'NEEDS_REVIEW',
    expectedCwe: 'CWE-798',
    rationale: 'A credential-like literal is present; confirm whether it is live or a fixture.',
    code: `const api_key = "sk_live_example_123456789";`
  },

  // 21. Secure Code: Argument-array process execution
  {
    id: 'eval-command-secure-21',
    title: 'Process Execution Uses an Argument Array',
    category: 'Command Injection',
    description: 'A fixed executable is invoked through execFile with separate arguments.',
    fileName: 'ping_service.js',
    language: 'javascript',
    expectedOutcome: 'SECURE',
    expectedClassification: 'FALSE_POSITIVE',
    rationale: 'No shell-string concatenation or shell execution sink is present.',
    code: `function ping(host) {
  return execFile('ping', ['-c', '1', host]);
}`
  }

];

/**
 * Runs the full evaluation suite and computes real Precision, Recall, and F1 metrics.
 */
export function runEvaluationSuite(testCases: EvaluationTestCase[] = EVALUATION_TEST_CASES): EvaluationMetrics {
  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;
  let excludedCases = 0;

  const results = testCases.map(tc => {
    const { findings } = analyzeSourceCodeContextAware(tc.code, tc.fileName);
    const activeFindings = findings.filter(f => f.verificationStatus !== 'FALSE_POSITIVE');
    const hasVulnerability = activeFindings.some(f => f.severity !== 'INFO');
    const expectedFinding = tc.expectedCwe
      ? activeFindings.find(f => f.cwe.split(':')[0].trim() === tc.expectedCwe)
      : activeFindings[0];
    const topClassification = expectedFinding?.verificationStatus || 'FALSE_POSITIVE';
    const classificationMatches = topClassification === tc.expectedClassification;
    const cweMatches = !tc.expectedCwe || !!expectedFinding;
    const sourceLineCount = tc.code.split('\n').length;
    const lineRangesValid = findings.every(f =>
      Number.isInteger(f.startLine) && Number.isInteger(f.endLine) &&
      f.startLine >= 1 && f.endLine >= f.startLine && f.endLine <= sourceLineCount
    );
    const includedInMetrics = tc.expectedOutcome !== 'NEEDS_REVIEW';
    let passed = classificationMatches && cweMatches && lineRangesValid;

    // Review-only fixtures are not ground-truth positives or negatives. Counting
    // them in the confusion matrix would inflate precision/recall without a
    // defensible binary label. They must still match their expected review state.
    if (!includedInMetrics) {
      excludedCases++;
    } else if (tc.expectedOutcome === 'VULNERABILITY') {
      if (hasVulnerability) truePositives++;
      else falseNegatives++;
      passed = passed && hasVulnerability;
    } else if (tc.expectedOutcome === 'SECURE' || tc.expectedOutcome === 'FALSE_POSITIVE_SUPPRESSED') {
      if (!hasVulnerability) trueNegatives++;
      else falsePositives++;
      passed = passed && !hasVulnerability;
    }

    return {
      id: tc.id,
      title: tc.title,
      passed,
      actualOutcome: topClassification === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : hasVulnerability ? 'VULNERABILITY' : 'SECURE',
      actualClassification: topClassification,
      actualCwes: activeFindings.map(f => f.cwe),
      cweMatches,
      lineRangesValid,
      includedInMetrics,
      reason: [
        tc.rationale,
        !classificationMatches ? `Expected classification ${tc.expectedClassification}, received ${topClassification}.` : '',
        !cweMatches ? `Expected CWE ${tc.expectedCwe} was not detected; observed ${activeFindings.map(f => f.cwe).join(', ') || 'no active findings'}.` : '',
        !lineRangesValid ? 'One or more findings contain line ranges outside the source file.' : ''
      ].filter(Boolean).join(' ')
    };
  });

  const evaluatedCases = testCases.length - excludedCases;
  // Undefined denominators are reported conservatively as 0 rather than
  // presenting an empty positive class as perfect precision or recall.
  const precision = (truePositives + falsePositives) > 0
    ? Number(((truePositives / (truePositives + falsePositives)) * 100).toFixed(1))
    : 0;
  const recall = (truePositives + falseNegatives) > 0
    ? Number(((truePositives / (truePositives + falseNegatives)) * 100).toFixed(1))
    : 0;
  const f1Score = (precision + recall) > 0
    ? Number(((2 * (precision * recall)) / (precision + recall)).toFixed(1))
    : 0;
  // An empty scored set has no measurable accuracy; report 0 rather than a false perfect score.
  const accuracy = evaluatedCases > 0
    ? Number((((truePositives + trueNegatives) / evaluatedCases) * 100).toFixed(1))
    : 0;

  return {
    totalTestCases: testCases.length,
    evaluatedCases,
    excludedCases,
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision,
    recall,
    f1Score,
    accuracy,
    timestamp: new Date().toISOString(),
    results
  };
}
