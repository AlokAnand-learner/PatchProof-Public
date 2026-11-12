/**
 * Fix Validator & Neutralization Safety Tests
 * Verifies that fixes are honestly evaluated, rejecting dynamic concatenation
 * disguised with fake parameters, and verifying full-file replacement parsing.
 */
import { validateRemediationPatch, checkSyntax } from '../src/engine/fixValidator';

console.log('===========================================================');
console.log('   PATCHPROOF FIX VALIDATOR & SEMANTIC CHECK SUITE         ');
console.log('===========================================================');

let passCount = 0;
let failCount = 0;

function assert(description: string, condition: boolean) {
  if (condition) {
    console.log(`[✓ PASS] ${description}`);
    passCount++;
  } else {
    console.error(`[✗ FAIL] ${description}`);
    failCount++;
  }
}

// 1. Reject fake parameter binding where concatenation still exists
const fakeSqlFix = 'cursor.execute(f"SELECT * FROM users WHERE name = \'{user}\'" + " ? ", [user])';
const sqlResult = validateRemediationPatch(
  fakeSqlFix,
  'cursor.execute(f"SELECT * FROM users WHERE name = \'{user}\'")',
  'CWE-89',
  'python',
  'user_service.py'
);
assert('Reject SQL fix that retains dynamic f-string formatting even if ? is appended', !sqlResult.vulnerabilityResolved && sqlResult.status !== 'VALIDATED');
assert('Include transparent checks run and limitations in result', (sqlResult.validationChecksRun?.length ?? 0) >= 3 && (sqlResult.limitations?.length ?? 0) > 0);

// 2. Validate legitimate parameterized query fix
const realSqlFix = 'cursor.execute("SELECT * FROM users WHERE name = ?", (user,))';
const realSqlResult = validateRemediationPatch(
  realSqlFix,
  'cursor.execute(f"SELECT * FROM users WHERE name = \'{user}\'")',
  'CWE-89',
  'python',
  'user_service.py'
);
assert('Validate genuine parameterized SQL query', realSqlResult.vulnerabilityResolved && realSqlResult.syntaxCheck.passed);

// 3. Reject path traversal fix lacking basename or containment
const unsafePathFix = 'const filePath = path.resolve(baseDir, req.query.file);';
const pathResult = validateRemediationPatch(
  unsafePathFix,
  'const filePath = path.join(baseDir, req.query.file);',
  'CWE-22',
  'javascript',
  'export.js'
);
assert('Reject path traversal fix that uses resolve() without basename or containment check', !pathResult.vulnerabilityResolved);

// 4. Validate genuine path traversal fix using path.basename
const safePathFix = 'const safeFile = path.basename(req.query.file);\nconst filePath = path.resolve(baseDir, safeFile);';
const safePathResult = validateRemediationPatch(
  safePathFix,
  'const filePath = path.join(baseDir, req.query.file);',
  'CWE-22',
  'javascript',
  'export.js'
);
assert('Validate path traversal fix utilizing path.basename', safePathResult.vulnerabilityResolved);

// 5. Full file replacement validation (syntax and whole-file checks)
const validFullJs = `
const express = require('express');
const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok' }));
module.exports = app;
`;
const fullValidation = checkSyntax(validFullJs, 'javascript');
assert('Validate syntax of entire replacement file', fullValidation.passed);

const invalidFullJs = `
function broken() {
  const x = 12;
  // Missing closing brace and syntax error
`;
const brokenValidation = checkSyntax(invalidFullJs, 'javascript');
assert('Detect syntax errors in broken replacement file', !brokenValidation.passed);

// 6. Audit Regression: Apostrophe in comment must not cause unclosed string error
const commentWithApostrophe = `
// Don't modify database configuration directly
const safePort = 3000;
`;
const apostropheCheck = checkSyntax(commentWithApostrophe, 'javascript');
assert('Apostrophe inside comment does not trigger unclosed string error', apostropheCheck.passed);

// 7. Audit Regression: ESM import statement must not fail syntax validation
const esmSnippet = `import express from 'express';\nconst router = express.Router();\nexport default router;`;
const esmCheck = checkSyntax(esmSnippet, 'javascript');
assert('ESM import/export statement is parsed safely without new Function error', esmCheck.passed);

// 8. Audit Regression: SQL concatenation with a comment containing '?' must FAIL validation
const sqlWithQuestionComment = `
// What about user ? query?
cursor.execute("SELECT * FROM users WHERE name = '" + user + "'");
`;
const sqlCommentResult = validateRemediationPatch(
  sqlWithQuestionComment,
  'cursor.execute("SELECT * FROM users WHERE name = \'" + user + "\'")',
  'CWE-89',
  'python',
  'user_service.py'
);
assert('SQL concatenation with a comment containing ? must fail validation', !sqlCommentResult.vulnerabilityResolved && sqlCommentResult.status === 'INVALID');

// 9. Audit Regression: Patch containing an undefined identifier must NOT receive VALIDATED
const undefinedIdentPatch = `
const userRecord = fetchUserFromDB(nonExistentUserId);
`;
const undefResult = validateRemediationPatch(
  undefinedIdentPatch,
  'const userRecord = null;',
  'CWE-89',
  'javascript',
  'user_service.js'
);
assert('Patch containing undefined identifier does not receive VALIDATED status', undefResult.status !== 'VALIDATED' && undefResult.undefinedVariables.length > 0);

// 10. Full-file validation must locate the exact original snippet exactly once
const missingTarget = validateRemediationPatch(
  'const safe = true;',
  'const original = true;',
  'CWE-89',
  'javascript',
  'app.js',
  'const untouched = true;'
);
assert('Reject full-file validation when the original snippet is absent', !missingTarget.fullFileValidationPassed && missingTarget.status === 'INVALID');

const duplicateTarget = validateRemediationPatch(
  'const safe = true;',
  'const original = true;',
  'CWE-89',
  'javascript',
  'app.js',
  'const original = true;\nconst original = true;'
);
assert('Reject full-file validation when the original snippet is ambiguous', !duplicateTarget.fullFileValidationPassed && duplicateTarget.status === 'INVALID');

console.log('===========================================================');
console.log(`Results: ${passCount} passed, ${failCount} failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✓ ALL FIX VALIDATOR INTEGRITY TESTS PASSED.');
  process.exit(0);
}
