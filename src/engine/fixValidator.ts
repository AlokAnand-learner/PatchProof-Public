/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  FixValidationResult, 
  FixValidationStatus, 
  FixCheckResult 
} from '../types/security';
import { analyzeSourceCodeContextAware } from './contextAnalyzer';

export interface FixValidationParams {
  originalSnippet: string;
  suggestedPatch: string;
  surroundingContext?: string;
  fullSourceCode?: string;
  language: string;
  filePath: string;
  vulnerabilityCwe: string;
}

// Standard modules that require an import statement if used in JS/TS
const KNOWN_JS_MODULES: Record<string, string> = {
  crypto: 'crypto',
  path: 'path',
  fs: 'fs',
  child_process: 'child_process',
  os: 'os',
  util: 'util',
  http: 'http',
  https: 'https',
  zlib: 'zlib',
  stream: 'stream',
  jwt: 'jsonwebtoken',
  bcrypt: 'bcrypt',
  validator: 'validator',
  DOMPurify: 'dompurify',
};

// Standard modules that require an import statement if used in Python
const KNOWN_PYTHON_MODULES: Record<string, string> = {
  secrets: 'secrets',
  hashlib: 'hashlib',
  subprocess: 'subprocess',
  os: 'os',
  sys: 'sys',
  shutil: 'shutil',
  re: 're',
  html: 'html',
  urllib: 'urllib',
  sqlite3: 'sqlite3',
};

/**
 * Intelligent Fix Validation Engine
 * Statically evaluates proposed security patches and complete replacement files
 * without ever executing untrusted application code.
 */
export function validateFix(params: FixValidationParams): FixValidationResult {
  const {
    originalSnippet,
    suggestedPatch,
    surroundingContext = '',
    fullSourceCode = '',
    language,
    filePath,
    vulnerabilityCwe
  } = params;

  const patchTrimmed = suggestedPatch.trim();
  const contextCombined = `${surroundingContext}\n${fullSourceCode}`;

  // 1. Syntax and structural consistency checks on the proposed patch
  const syntaxCheck = checkSyntax(patchTrimmed, language);

  // 2. Full Replacement File Check (if fullSourceCode provided)
  let fullFileValidationPassed = true;
  if (fullSourceCode && fullSourceCode.trim().length > 0 && originalSnippet) {
    const fullPatched = fullSourceCode.replace(originalSnippet, patchTrimmed);
    const fullFileSyntax = checkSyntax(fullPatched, language);
    if (!fullFileSyntax.passed) {
      fullFileValidationPassed = false;
      syntaxCheck.passed = false;
      syntaxCheck.status = 'FAIL';
      syntaxCheck.message = `Full file syntax failure: ${fullFileSyntax.message}`;
    }
  }

  // 3. Scope & Import Resolution Check
  const scopeAndImportsCheck = checkScopeAndImports(patchTrimmed, contextCombined, language);

  // 4. Security Regression & Insecure Fallback Check
  const regressionCheck = checkSecurityRegressions(patchTrimmed, vulnerabilityCwe, filePath);

  // 5. Vulnerability Neutralization Check (Strict semantic validation)
  const neutralizationCheck = checkVulnerabilityNeutralization(
    originalSnippet,
    patchTrimmed,
    vulnerabilityCwe,
    filePath
  );

  // 6. Completeness & Placeholder Check
  const completenessCheck = checkCompleteness(patchTrimmed);

  // Identify specific items
  const missingImports = scopeAndImportsCheck.details?.filter(d => d.startsWith('Missing module:'))
    .map(d => d.replace('Missing module:', '').trim()) || [];
  const undefinedVariables = scopeAndImportsCheck.details?.filter(d => d.startsWith('Undeclared variable:'))
    .map(d => d.replace('Undeclared variable:', '').trim()) || [];
  const introducedVulnerabilities = regressionCheck.details || [];
  const insecureFallbacks = findInsecureFallbacks(patchTrimmed);

  // Derive Compatibility Notes
  const potentialCompatibilityIssues: string[] = [];
  if (missingImports.length > 0) {
    potentialCompatibilityIssues.push(
      `Requires importing: ${missingImports.join(', ')} at the top of the file.`
    );
  }
  if (patchTrimmed.includes('process.env.') || patchTrimmed.includes('os.environ')) {
    potentialCompatibilityIssues.push(
      'Requires appropriate environment variables to be defined in runtime environment configuration.'
    );
  }
  if (/async|await/i.test(patchTrimmed) && !/async/i.test(surroundingContext)) {
    potentialCompatibilityIssues.push(
      'Introduces asynchronous operations. Ensure the enclosing function is declared with "async".'
    );
  }

  // Derive Security Improvement description
  let securityImprovement = '';
  if (neutralizationCheck.passed) {
    securityImprovement = `Neutralizes ${vulnerabilityCwe} by eliminating direct sink interpolation and applying defensive controls.`;
  } else {
    securityImprovement = `Fix does not fully address ${vulnerabilityCwe}; dangerous patterns or unparameterized queries remain in the proposed code.`;
  }

  // Calculate Overall Score (0 - 100)
  let score = 100;
  if (!syntaxCheck.passed) score -= 45;
  if (!neutralizationCheck.passed) score -= 35;
  if (!regressionCheck.passed) score -= 40;
  if (missingImports.length > 0) score -= 15;
  if (undefinedVariables.length > 0) score -= 25;
  if (insecureFallbacks.length > 0) score -= 25;
  if (!completenessCheck.passed) score -= 20;
  score = Math.max(0, Math.min(100, score));

  // Determine Overall Status - NEVER display green VALIDATED when validation is incomplete or failing
  let status: FixValidationStatus = 'VALIDATED';

  if (!syntaxCheck.passed || !neutralizationCheck.passed || !regressionCheck.passed || undefinedVariables.length > 0) {
    status = 'INVALID';
  } else if (missingImports.length > 0 || insecureFallbacks.length > 0 || !completenessCheck.passed) {
    status = 'PARTIALLY_VALIDATED';
  } else if (/async|await/i.test(patchTrimmed) && !/async/i.test(surroundingContext)) {
    status = 'NEEDS_REVIEW';
  } else {
    status = 'VALIDATED';
  }

  const validationChecksRun = [
    'Static Syntax and Delimiter Checks',
    'Full Replacement File Integrity Check',
    'Scope & Required Import Resolution Check',
    'Vulnerability-Specific Neutralization Verification',
    'Security Regression & Insecure Fallback Scan',
    'Placeholder & Completeness Audit'
  ];

  const limitations = [
    'Untrusted code is never executed: dynamic runtime interactions, database drivers, and network requests are not executed.',
    'Verification uses language-limited syntax parsing where available, delimiter checks, scope heuristics, and security pattern analysis. It is not a full AST or runtime verification.',
    'External packages and third-party type definitions outside standard libraries require manual runtime verification.'
  ];

  return {
    status,
    overallScore: score,
    vulnerabilityResolved: neutralizationCheck.passed,
    securityImprovement,
    potentialCompatibilityIssues,
    syntaxCheck,
    scopeAndImportsCheck,
    securityRegressionCheck: regressionCheck,
    completenessCheck,
    missingImports,
    undefinedVariables,
    introducedVulnerabilities,
    insecureFallbacks,
    timestamp: new Date().toISOString(),
    executionMode: 'STATIC_ISOLATED_CHECKS',
    validationChecksRun,
    limitations,
    fullFileValidationPassed
  };
}

/**
 * Convenience helper for verifying individual remediation patches
 */
export function validateRemediationPatch(
  suggestedPatch: string,
  originalSnippet: string,
  vulnerabilityCwe: string,
  language: string,
  filePath: string,
  fullSourceCode?: string
): FixValidationResult {
  return validateFix({
    suggestedPatch,
    originalSnippet,
    vulnerabilityCwe,
    language,
    filePath,
    fullSourceCode
  });
}

/**
 * 1. Syntax Check via isolated static structural balance & syntax parsing (No execution)
 */
export function checkSyntax(patch: string, language: string): FixCheckResult {
  const lang = (language || '').toLowerCase();
  const isJsTs = ['javascript', 'typescript', 'js', 'ts', 'jsx', 'tsx', 'node'].includes(lang) ||
    patch.includes('const ') || patch.includes('let ') || patch.includes('function') || patch.includes('=>');

  // Structural delimiter and bracket balance check
  const structuralCheck = checkStructuralBalance(patch);
  if (!structuralCheck.valid) {
    return {
      passed: false,
      status: 'FAIL',
      name: 'Syntax & Structural Balance',
      message: structuralCheck.error || 'Unbalanced brackets or structural syntax error.',
      details: [structuralCheck.error || 'Syntax mismatch']
    };
  }

  // Pure JavaScript syntax parsing check (without executing)
  if (isJsTs && !lang.includes('ts') && !lang.includes('tsx') && !patch.includes(': string') && !patch.includes(': number') && !patch.includes(': boolean')) {
    // If patch contains ESM import or export syntax, new Function() throws SyntaxError: Cannot use import statement outside a module.
    // Wrap module code in AsyncFunction or parse without failing on ESM keywords.
    const isEsm = /\b(import\s+|export\s+default|export\s+\{)/.test(patch);
    if (!isEsm) {
      try {
        // Compiles code through engine parser to verify syntax without executing
        new Function(patch);
      } catch (err: any) {
        if (err instanceof SyntaxError) {
          return {
            passed: false,
            status: 'FAIL',
            name: 'Syntax and Structural Checks',
            message: `Syntax error: ${err.message}`,
            details: [err.message]
          };
        }
      }
    }
  }

  return {
    passed: true,
    status: 'PASS',
    name: 'Syntax and Structural Checks',
    message: 'Configured static syntax and delimiter checks passed. This is not a full compiler or runtime check.'
  };
}

/**
 * Validates bracket, parenthesis, and string delimiter balance.
 * Comments are stripped first so apostrophes (e.g. "don't") inside comments do not trigger unclosed string errors.
 */
function checkStructuralBalance(code: string): { valid: boolean; error?: string } {
  // Strip single-line and multi-line comments before checking delimiter balance
  const cleanCode = stripComments(code);

  const stack: string[] = [];
  let inString: string | null = null;
  let escape = false;

  for (let i = 0; i < cleanCode.length; i++) {
    const char = cleanCode[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
    } else if (char === ')' || char === ']' || char === '}') {
      const last = stack.pop();
      if (!last) return { valid: false, error: `Unexpected closing "${char}".` };
      if (char === ')' && last !== '(') return { valid: false, error: 'Mismatched parenthesis ")".' };
      if (char === ']' && last !== '[') return { valid: false, error: 'Mismatched square bracket "]".' };
      if (char === '}' && last !== '{') return { valid: false, error: 'Mismatched curly brace "}".' };
    }
  }

  if (inString) {
    return { valid: false, error: `Unclosed string literal starting with ${inString}.` };
  }
  if (stack.length > 0) {
    return { valid: false, error: `Unclosed delimiter "${stack[stack.length - 1]}".` };
  }

  return { valid: true };
}

/**
 * Strips comments from code to avoid false positives during import and token inspection
 */
function stripComments(code: string): string {
  return code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#[^\n]*/g, '')
    .replace(/"""[\s\S]*?"""/g, '')
    .replace(/'''[\s\S]*?'''/g, '');
}

/**
 * 2. Scope & Import Resolution Check
 */
function checkScopeAndImports(
  patch: string,
  context: string,
  language: string
): FixCheckResult {
  const lang = (language || '').toLowerCase();
  const isPython = lang.includes('python') || lang.includes('py');
  const cleanPatch = stripComments(patch);
  const cleanContext = stripComments(context);
  const details: string[] = [];

  // A. Check for Missing Imports
  const moduleMap = isPython ? KNOWN_PYTHON_MODULES : KNOWN_JS_MODULES;
  for (const [modIdentifier, modPackage] of Object.entries(moduleMap)) {
    const pattern = new RegExp(`\\b${modIdentifier}\\.[a-zA-Z0-9_]+`, 'g');
    if (pattern.test(cleanPatch)) {
      const patchImports = isPython
        ? new RegExp(`import\\s+${modIdentifier}|from\\s+${modIdentifier}\\s+import`, 'i').test(cleanPatch)
        : new RegExp(`(import.*from\\s*['"]${modPackage}['"]|require\\(['"]${modPackage}['"]\\))`, 'i').test(cleanPatch);

      const contextImports = isPython
        ? new RegExp(`import\\s+${modIdentifier}|from\\s+${modIdentifier}\\s+import`, 'i').test(cleanContext)
        : new RegExp(`(import.*from\\s*['"]${modPackage}['"]|require\\(['"]${modPackage}['"]\\))`, 'i').test(cleanContext);

      if (!patchImports && !contextImports) {
        details.push(`Missing module: ${modIdentifier} (must import '${modPackage}')`);
      }
    }
  }

  // B. Check for Undefined / Invented Variables in Patch
  const undeclaredVars = findUndeclaredVariables(patch, context);
  for (const uv of undeclaredVars) {
    details.push(`Undeclared variable: ${uv}`);
  }

  if (details.some(d => d.startsWith('Undeclared variable:'))) {
    return {
      passed: false,
      status: 'FAIL',
      name: 'Scope & Import Resolution',
      message: 'Fix references undefined variables not found in parameters or context scope.',
      details
    };
  }

  if (details.length > 0) {
    return {
      passed: true,
      status: 'WARN',
      name: 'Scope & Import Resolution',
      message: `Fix relies on modules (${details.map(d => d.replace('Missing module:', '').trim()).join(', ')}) that should be imported.`,
      details
    };
  }

  return {
    passed: true,
    status: 'PASS',
    name: 'Scope & Import Resolution',
    message: 'All referenced identifiers and modules are resolved in local or imported scope.'
  };
}

/**
 * Statically detects undeclared variables in the patch that are not in parameters or context.
 * Collects identifiers that are used on the right-hand side of assignments, expressions,
 * or arguments without being defined in the patch, surrounding context, or runtime globals.
 */
function findUndeclaredVariables(patch: string, context: string): string[] {
  const undeclared: string[] = [];

  const commonGlobals = new Set([
    'console', 'process', 'require', 'module', 'exports', 'window', 'document', 'global',
    'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'RegExp',
    'Error', 'TypeError', 'SyntaxError', 'Promise', 'Set', 'Map', 'Buffer', 'URL', 'Blob',
    'encodeURIComponent', 'decodeURIComponent', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'undefined', 'null', 'true', 'false', 'NaN', 'Infinity',
    // Python common built-ins
    'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'bool',
    'open', 'self', 'cls', 'Exception', 'ValueError', 'TypeError', 'None', 'True', 'False'
  ]);

  const cleanPatch = stripComments(patch);
  const cleanContext = stripComments(context);

  // Extract declared identifiers in patch e.g. const x, let x, var x, function x, def x, (x, y) =>
  const declaredInPatch = new Set<string>();
  const declRegex = /(?:const|let|var|def|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let match: RegExpExecArray | null;
  while ((match = declRegex.exec(cleanPatch)) !== null) {
    declaredInPatch.add(match[1]);
  }

  // Also check for function parameter lists e.g. (req, res), def func(x, y)
  const paramRegex = /(?:\(|function\s*\w*\s*\(|def\s*\w*\s*\()([^)]*)\)/g;
  while ((match = paramRegex.exec(cleanPatch)) !== null) {
    const params = match[1].split(',').map(p => p.trim().split(/[\s=:]/)[0]).filter(Boolean);
    for (const p of params) {
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p)) {
        declaredInPatch.add(p);
      }
    }
  }

  // Scan for identifiers used in patch
  const identRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]{2,})\b/g;
  const seenInPatch = new Set<string>();
  while ((match = identRegex.exec(cleanPatch)) !== null) {
    const ident = match[1];
    if (commonGlobals.has(ident) || declaredInPatch.has(ident) || seenInPatch.has(ident)) {
      continue;
    }
    seenInPatch.add(ident);

    // Is it declared or referenced in surrounding context?
    const inContext = new RegExp(`\\b${ident}\\b`).test(cleanContext);
    // Is it a property access e.g. obj.ident?
    const isPropAccess = new RegExp(`\\.\\s*${ident}\\b`).test(cleanPatch);
    // Is it a known keyword?
    const isKeyword = /^(if|else|for|while|return|switch|case|break|continue|try|catch|finally|throw|class|extends|super|import|export|from|as|default|typeof|instanceof|void|delete|new|in|of|yield|await|async)$/.test(ident);

    if (!inContext && !isPropAccess && !isKeyword) {
      // Check if it appears as an unassigned value or function call
      const isCallOrValue = new RegExp(`(?:=\\s*|\\(\\s*|,\\s*|\\breturn\\s+)\\s*${ident}\\b`).test(cleanPatch);
      if (isCallOrValue) {
        undeclared.push(ident);
      }
    }
  }

  return undeclared;
}

/**
 * 3. Security Regression Check: Verifies whether the patch introduces another security problem
 */
function checkSecurityRegressions(
  patch: string,
  targetCwe: string,
  filePath: string
): FixCheckResult {
  const regressions: string[] = [];

  // Check 1: Insecure hardcoded fallback secrets
  const fallbackMatch = patch.match(/process\.env\.[a-zA-Z0-9_]+\s*\|\|\s*["'][a-zA-Z0-9_\-\.\@\#]{6,}["']/i) ||
    patch.match(/os\.environ\.get\([^,]+,\s*["'][a-zA-Z0-9_\-\.\@\#]{6,}["']\)/i);
  if (fallbackMatch) {
    regressions.push('Introduces hardcoded fallback secret when environment variable is unset.');
  }

  // Check 2: Direct eval or new Function introduction
  if (/\beval\s*\(|new\s+Function\s*\(/.test(patch)) {
    regressions.push('Introduces dynamic code evaluation (eval / Function constructor).');
  }

  // Check 3: Shell invocation (OS Command Injection)
  if (
    /shell\s*=\s*True/i.test(patch) ||
    /child_process\.exec\s*\(/.test(patch) ||
    /os\.system\s*\(/.test(patch)
  ) {
    regressions.push('Introduces shell execution with command injection risk.');
  }

  // Check 4: Disabling SSL / TLS certificate verification
  if (/verify\s*=\s*False|rejectUnauthorized\s*:\s*false/i.test(patch)) {
    regressions.push('Disables TLS certificate verification, enabling Man-in-the-Middle (MitM) attacks.');
  }

  // Check 5: Insecure PRNG for security tokens
  if (
    /Math\.random\(\)|rand\.Seed\(|math\/rand/i.test(patch) &&
    (/token|secret|session|nonce|key/i.test(patch) || /CWE-338/i.test(targetCwe))
  ) {
    regressions.push('Uses cryptographically weak pseudo-random generator (Math.random) for security tokens.');
  }

  // Check 6: Permissive wildcards in CORS or origins
  if (/Access-Control-Allow-Origin.*\*.*credentials/i.test(patch) || /origin:\s*["']\*["']/i.test(patch)) {
    regressions.push('Introduces overly permissive wildcard CORS policy.');
  }

  // Run full static context analyzer on the patch to catch any latent CWEs
  const { findings } = analyzeSourceCodeContextAware(patch, filePath);
  const activeFindings = findings.filter(f => f.verificationStatus !== 'FALSE_POSITIVE');
  for (const f of activeFindings) {
    if (!targetCwe.includes(f.cwe.split(':')[0])) {
      regressions.push(`Introduced new vulnerability: ${f.title} (${f.cwe})`);
    }
  }

  if (regressions.length > 0) {
    return {
      passed: false,
      status: 'FAIL',
      name: 'Security Regression Check',
      message: 'Patch introduces secondary security vulnerabilities or insecure fallbacks.',
      details: regressions
    };
  }

  return {
    passed: true,
    status: 'PASS',
    name: 'Security Regression Check',
    message: 'Zero security regressions detected; patch does not introduce secondary weaknesses.'
  };
}

/**
 * 4. Vulnerability Neutralization Check (Strict semantic validation)
 */
function checkVulnerabilityNeutralization(
  originalSnippet: string,
  patch: string,
  targetCwe: string,
  filePath: string
): FixCheckResult {
  const cweLower = targetCwe.toLowerCase();

  // Test SQL Injection (CWE-89)
  if (cweLower.includes('89') || cweLower.includes('sql')) {
    // Strip comments so comments containing ? or ternary expressions don't satisfy parameter checks
    const cleanPatch = stripComments(patch);

    // Dynamic string interpolation remains in query (f-strings, +, %, ${...}, concatenation)
    const hasUnsafeConcat = /(SELECT|INSERT|UPDATE|DELETE)\s+.*(\+|\%|\$|f"|f'|\`|\$\{)/i.test(cleanPatch) ||
      /\+\s*(?:username|id|input|param|query|user|request)/i.test(cleanPatch) ||
      /WHERE\s+[a-zA-Z0-9_]+\s*=\s*['"]\s*\+/i.test(cleanPatch);

    // Requires actual parameter placeholder and binding tuple/array
    const hasParameterized = (
      /(\.query|\.execute)\s*\(\s*["'`][^"'`]+["'`]\s*,\s*(\[|\()/i.test(cleanPatch) ||
      /cursor\.execute\s*\(\s*["'][^"']+["']\s*,\s*(\(|\[|\w+)/i.test(cleanPatch) ||
      /query\s*,\s*params/i.test(cleanPatch) ||
      /bind_param|prepareStatement/i.test(cleanPatch)
    ) && !hasUnsafeConcat;

    if (hasUnsafeConcat || !hasParameterized) {
      return {
        passed: false,
        status: 'FAIL',
        name: 'Vulnerability Neutralization',
        message: 'SQL Injection: Fix does not bind parameters to query placeholders; string interpolation or unparameterized query persists.',
        details: ['Query lacks safe placeholder binding or retains dynamic string concatenation.']
      };
    }
  }

  // Test Command Injection (CWE-78)
  if (cweLower.includes('78') || cweLower.includes('command')) {
    const stillHasExec = /os\.popen|os\.system|child_process\.exec\s*\(/.test(patch);
    const usesSafeArray = /execFile|subprocess\.run|subprocess\.Popen/.test(patch) &&
      !/shell\s*=\s*True/i.test(patch);

    if (stillHasExec || !usesSafeArray) {
      return {
        passed: false,
        status: 'FAIL',
        name: 'Vulnerability Neutralization',
        message: 'Command Injection: Patch still invokes operating system shell with dynamic command string.',
        details: ['Requires non-shell argument arrays (e.g. execFile or subprocess.run with shell=False).']
      };
    }
  }

  // Test Hardcoded Secrets (CWE-798)
  if (cweLower.includes('798') || cweLower.includes('credential') || cweLower.includes('secret')) {
    const stillHasHardcoded = /(secret|password|key)\s*=\s*["'][a-zA-Z0-9_\-\.\@\#\$\%]{10,}["']/i.test(patch) &&
      !patch.includes('process.env') &&
      !patch.includes('os.environ');

    if (stillHasHardcoded) {
      return {
        passed: false,
        status: 'FAIL',
        name: 'Vulnerability Neutralization',
        message: 'Hardcoded Secret: Plaintext credential string remains in source code.',
        details: ['Credentials must be resolved from environment variables or vault at runtime.']
      };
    }
  }

  // Test Path Traversal (CWE-22)
  if (cweLower.includes('22') || cweLower.includes('traversal')) {
    const hasSanitization = /path\.basename|os\.path\.basename|secure_filename|\.startsWith\s*\(.*baseDir\)/i.test(patch);
    if (!hasSanitization && (patch.includes('path.join') || patch.includes('path.resolve') || patch.includes('open(') || patch.includes('ReadFile'))) {
      return {
        passed: false,
        status: 'FAIL',
        name: 'Vulnerability Neutralization',
        message: 'Path Traversal: Path concatenation lacks verified boundary containment (e.g. path.basename or startsWith check).',
        details: ['Missing basename or safe directory containment check.']
      };
    }
  }

  // Re-run context analyzer on the patch to confirm the target CWE is not triggered
  const { findings } = analyzeSourceCodeContextAware(patch, filePath);
  const activeFlaws = findings.filter(f => f.verificationStatus !== 'FALSE_POSITIVE');
  const targetFlawRemains = activeFlaws.some(f => targetCwe.includes(f.cwe.split(':')[0]));

  if (targetFlawRemains) {
    return {
      passed: false,
      status: 'FAIL',
      name: 'Vulnerability Neutralization',
      message: 'Original security vulnerability pattern was still detected in the remediated code.',
      details: ['Target CWE signature was flagged on the suggested replacement.']
    };
  }

  return {
    passed: true,
    status: 'PASS',
    name: 'Vulnerability Neutralization',
    message: 'Confirmed: Original vulnerability pattern is effectively neutralized.'
  };
}

/**
 * 5. Completeness & Placeholder Check
 */
function checkCompleteness(patch: string): FixCheckResult {
  const placeholders = [
    '// ... rest of code',
    '/* ... */',
    '# ... remaining code',
    'YOUR_API_KEY_HERE',
    '<INSERT_KEY_HERE>',
    'TODO: implement',
    '// TODO'
  ];

  const foundPlaceholders = placeholders.filter(p => patch.includes(p));

  if (foundPlaceholders.length > 0) {
    return {
      passed: false,
      status: 'WARN',
      name: 'Completeness Check',
      message: 'Patch contains unfinished placeholder tokens that require manual code replacement.',
      details: foundPlaceholders.map(p => `Contains placeholder: "${p}"`)
    };
  }

  return {
    passed: true,
    status: 'PASS',
    name: 'Completeness Check',
    message: 'Patch provides a complete, drop-in replacement with no unresolved placeholders.'
  };
}

/**
 * Identifies insecure fallback patterns
 */
function findInsecureFallbacks(patch: string): string[] {
  const fallbacks: string[] = [];
  const regex = /(process\.env\.[A-Z0-9_]+\s*\|\|\s*["'][^"']+["']|os\.environ\.get\([^,]+,\s*["'][^"']+["']\))/gi;
  let match;
  while ((match = regex.exec(patch)) !== null) {
    fallbacks.push(match[0]);
  }
  return fallbacks;
}
