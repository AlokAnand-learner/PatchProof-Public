import { FixValidationTestCase, FixValidationResult } from '../types/security';
import { validateFix } from '../engine/fixValidator';

export const FIX_VALIDATION_TEST_CASES: FixValidationTestCase[] = [
  // 1. Hardcoded JWT secret remediation (Validated)
  {
    id: 'fix-eval-01-jwt-secret',
    title: 'Hardcoded JWT Secret Key Remediation',
    category: 'Secrets Management',
    description: 'Replaces hardcoded plaintext JWT signature key with environment variable resolution and existence check.',
    fileName: 'authService.js',
    language: 'javascript',
    vulnerabilityCwe: 'CWE-798',
    vulnerabilityTitle: 'Hardcoded Secret Key or Token',
    originalSnippet: 'const token = jwt.sign({ id: user.id }, "my_super_secret_jwt_key_12345", { expiresIn: "1h" });',
    surroundingContext: `const jwt = require('jsonwebtoken');
function generateToken(user) {
  const token = jwt.sign({ id: user.id }, "my_super_secret_jwt_key_12345", { expiresIn: "1h" });
  return token;
}`,
    proposedPatch: `const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET environment variable is not defined");
}
const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: "1h" });`,
    expectedStatus: 'VALIDATED',
    notes: 'Eliminates plaintext secret, enforces runtime environment variable check, contains zero insecure fallbacks.'
  },

  // 2. OS command injection remediation (Validated)
  {
    id: 'fix-eval-02-command-injection',
    title: 'OS Command Injection Remediation',
    category: 'Command Injection',
    description: 'Replaces shell-concatenated exec invocation with execFile using strict argument array and hostname validation.',
    fileName: 'networkDiagnostic.js',
    language: 'javascript',
    vulnerabilityCwe: 'CWE-78',
    vulnerabilityTitle: 'OS Command Injection via Shell Invocation',
    originalSnippet: "child_process.exec('ping -c 2 ' + req.query.host, (err, stdout) => { res.send(stdout); });",
    surroundingContext: `const child_process = require('child_process');
app.get('/ping', (req, res) => {
  child_process.exec('ping -c 2 ' + req.query.host, (err, stdout) => { res.send(stdout); });
});`,
    proposedPatch: `const host = String(req.query.host || '');
if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
  return res.status(400).send('Invalid target host parameter');
}
child_process.execFile('/bin/ping', ['-c', '2', host], (err, stdout) => {
  if (err) return res.status(500).send('Diagnostic error');
  res.send(stdout);
});`,
    expectedStatus: 'VALIDATED',
    notes: 'Switches to execFile with non-shell argument array and regex whitelist validation.'
  },

  // 3. Missing imports (Partially Validated / Warning)
  {
    id: 'fix-eval-03-missing-imports',
    title: 'Cryptographic Token Fix with Missing Module Import',
    category: 'Scope & Imports',
    description: 'Fixes weak PRNG Math.random() by introducing crypto.randomBytes, but fails to import or require the crypto module.',
    fileName: 'tokenGenerator.js',
    language: 'javascript',
    vulnerabilityCwe: 'CWE-338',
    vulnerabilityTitle: 'Cryptographically Weak Pseudo-Random Number Generator',
    originalSnippet: 'const sessionToken = Math.random().toString(36).substring(2);',
    surroundingContext: `// No crypto module imported at top of file
function createSession() {
  const sessionToken = Math.random().toString(36).substring(2);
  return sessionToken;
}`,
    proposedPatch: `// Fix uses crypto without importing require('crypto')
const sessionToken = crypto.randomBytes(32).toString('hex');`,
    expectedStatus: 'PARTIALLY_VALIDATED',
    expectedCheckFailures: ['Missing module: crypto'],
    notes: 'Resolves CWE-338, but requires the developer to add const crypto = require("crypto") at file header.'
  },

  // 4. Undefined variables (Invalid)
  {
    id: 'fix-eval-04-undefined-variables',
    title: 'Fix Referencing Undeclared Variable',
    category: 'Variable Scope',
    description: 'Attempts to remediate SQL injection but references an un-scoped, undeclared variable (sanitizedSearchQuery).',
    fileName: 'searchController.js',
    language: 'javascript',
    vulnerabilityCwe: 'CWE-89',
    vulnerabilityTitle: 'SQL Injection via Unsanitized Input Concatenation',
    originalSnippet: 'const query = "SELECT * FROM items WHERE name = \'" + req.query.q + "\'";',
    surroundingContext: `app.get('/search', (req, res) => {
  const q = req.query.q;
  const query = "SELECT * FROM items WHERE name = '" + req.query.q + "'";
  db.query(query, (err, rows) => res.json(rows));
});`,
    proposedPatch: `// Bug: references "sanitizedSearchQuery" which was never declared
db.query("SELECT * FROM items WHERE name = ?", [sanitizedSearchQuery], (err, rows) => {
  res.json(rows);
});`,
    expectedStatus: 'INVALID',
    expectedCheckFailures: ['Undeclared variable: sanitizedSearchQuery'],
    notes: 'Static scope analyzer flags sanitizedSearchQuery as an undeclared variable; rejects invalid fix.'
  },

  // 5. Invalid syntax (Invalid)
  {
    id: 'fix-eval-05-invalid-syntax',
    title: 'Remediation with Broken Syntax / Unclosed Delimiters',
    category: 'Code Correctness',
    description: 'AI-generated fix contains unclosed brackets and syntax errors that fail AST parsing.',
    fileName: 'accountController.js',
    language: 'javascript',
    vulnerabilityCwe: 'CWE-89',
    vulnerabilityTitle: 'SQL Injection via Unsanitized Input Concatenation',
    originalSnippet: 'const query = "SELECT * FROM accounts WHERE id = " + req.query.id;',
    surroundingContext: `app.get('/account', (req, res) => {
  const query = "SELECT * FROM accounts WHERE id = " + req.query.id;
  db.query(query, (err, acc) => res.json(acc));
});`,
    proposedPatch: `// Syntax error: missing closing parenthesis and bracket
db.query("SELECT * FROM accounts WHERE id = ?", [req.query.id], (err, acc => {
  res.json(acc);`,
    expectedStatus: 'INVALID',
    expectedCheckFailures: ['Syntax error'],
    notes: 'Static syntax & delimiter parser intercepts syntax error before code is presented to user.'
  },

  // 6. Fix introducing another security problem (Invalid)
  {
    id: 'fix-eval-06-security-regression',
    title: 'Fix Introducing Secondary Vulnerability (Regression)',
    category: 'Security Regression',
    description: 'Fix fixes SQL injection via parameters, but introduces an insecure fallback secret and dynamic code evaluation (eval).',
    fileName: 'securityBootstrap.js',
    language: 'javascript',
    vulnerabilityCwe: 'CWE-89',
    vulnerabilityTitle: 'SQL Injection via Unsanitized Input Concatenation',
    originalSnippet: 'db.query("SELECT * FROM users WHERE role = \'" + role + "\'");',
    surroundingContext: `function fetchRoleUsers(role) {
  db.query("SELECT * FROM users WHERE role = '" + role + "'");
}`,
    proposedPatch: `// Remediates SQL query, but introduces insecure fallback key and dynamic eval!
const internalKey = process.env.ADMIN_KEY || "hardcoded_backup_admin_secret_999";
eval("global.securityContext = '" + internalKey + "'");
db.query("SELECT * FROM users WHERE role = ?", [role]);`,
    expectedStatus: 'INVALID',
    expectedCheckFailures: ['Introduces hardcoded fallback secret', 'Introduces dynamic code evaluation'],
    notes: 'Security regression check intercepts insecure fallback and dynamic eval; rejects patch as INVALID.'
  }
];

export interface FixValidationSuiteReport {
  timestamp: string;
  totalTests: number;
  passCount: number;
  failCount: number;
  accuracy: number;
  results: Array<{
    id: string;
    title: string;
    category: string;
    expectedStatus: string;
    actualStatus: string;
    passed: boolean;
    overallScore: number;
    syntaxPassed: boolean;
    scopePassed: boolean;
    regressionPassed: boolean;
    resolutionPassed: boolean;
    notes: string;
    validation: FixValidationResult;
  }>;
  limitations: string[];
}

/**
 * Runs the full 6-test Fix Validation Suite and computes real test results without fabrication.
 */
export function runFixValidationSuite(): FixValidationSuiteReport {
  let passedCount = 0;

  const results = FIX_VALIDATION_TEST_CASES.map(tc => {
    const validation = validateFix({
      originalSnippet: tc.originalSnippet,
      suggestedPatch: tc.proposedPatch,
      surroundingContext: tc.surroundingContext,
      language: tc.language,
      filePath: tc.fileName,
      vulnerabilityCwe: tc.vulnerabilityCwe
    });

    const isMatch = validation.status === tc.expectedStatus;
    if (isMatch) {
      passedCount++;
    }

    return {
      id: tc.id,
      title: tc.title,
      category: tc.category,
      expectedStatus: tc.expectedStatus,
      actualStatus: validation.status,
      passed: isMatch,
      overallScore: validation.overallScore,
      syntaxPassed: validation.syntaxCheck.passed,
      scopePassed: validation.scopeAndImportsCheck.passed,
      regressionPassed: validation.securityRegressionCheck.passed,
      resolutionPassed: validation.vulnerabilityResolved,
      notes: tc.notes,
      validation
    };
  });

  return {
    timestamp: new Date().toISOString(),
    totalTests: FIX_VALIDATION_TEST_CASES.length,
    passCount: passedCount,
    failCount: FIX_VALIDATION_TEST_CASES.length - passedCount,
    accuracy: Number(((passedCount / FIX_VALIDATION_TEST_CASES.length) * 100).toFixed(1)),
    results,
    limitations: [
      'Static AST parsing evaluates syntactic correctness, but does not execute runtime logic or dynamic dependencies.',
      'Variable scope analysis is limited to local file scope and immediate function enclosing blocks.',
      'Targeted unit test execution is simulated via static invariant analysis to strictly avoid running untrusted code.',
      'Language-specific runtime environments (e.g. non-standard Python packages) require runtime type definitions.'
    ]
  };
}
