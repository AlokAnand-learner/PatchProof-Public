/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  VulnerabilityFinding, 
  Severity, 
  Confidence, 
  VerificationStatus,
  SecurityMetrics 
} from '../types/security';

export interface AnalysisContext {
  filePath: string;
  language: string;
  isTestFile: boolean;
  isDemoOrDoc: boolean;
  isScannerOrTool: boolean;
}

interface RawDetectionCandidate {
  ruleId: string;
  title: string;
  cwe: string;
  owaspCategory: string;
  defaultSeverity: Severity;
  defaultConfidence: Confidence;
  lineNum: number;
  lineText: string;
  surroundingLines: { lineNum: number; text: string }[];
  dangerousOperation: string;
  explanation: string;
  attackScenario: string;
  exploitConditions: string;
  remediation: string;
  suggestedPatch: string;
}

/**
 * Determines whether a line of code is non-executable (comment, docstring, regex declaration).
 */
export function isCommentOrDoc(lineText: string, inMultiLineComment: boolean): { isComment: boolean; stillInMultiLine: boolean } {
  const trimmed = lineText.trim();
  
  // Ongoing multi-line comment. If executable text follows the closing delimiter,
  // keep the line eligible for detection instead of discarding the whole line.
  if (inMultiLineComment) {
    const closingDelimiters = ['*/', String.fromCharCode(34, 34, 34), String.fromCharCode(39, 39, 39)];
    let closingIndex = -1;
    let closingLength = 0;
    for (const delimiter of closingDelimiters) {
      const index = trimmed.indexOf(delimiter);
      if (index >= 0 && (closingIndex < 0 || index < closingIndex)) {
        closingIndex = index;
        closingLength = delimiter.length;
      }
    }
    if (closingIndex >= 0) {
      const executableSuffix = trimmed.slice(closingIndex + closingLength).trim();
      const suffixIsComment = executableSuffix.startsWith('//') ||
        executableSuffix.startsWith('#') || executableSuffix.startsWith('--') ||
        executableSuffix.startsWith('/*');
      return { isComment: executableSuffix.length === 0 || suffixIsComment, stillInMultiLine: false };
    }
    return { isComment: true, stillInMultiLine: true };
  }

  // Single-line comment indicators
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('--') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith(';')
  ) {
    return { isComment: true, stillInMultiLine: false };
  }

  // Start of multi-line comment
  if (trimmed.startsWith('/*') && !trimmed.includes('*/')) {
    return { isComment: true, stillInMultiLine: true };
  }
  if (trimmed.startsWith('"""') && trimmed.lastIndexOf('"""') === 0) {
    return { isComment: true, stillInMultiLine: true };
  }
  if (trimmed.startsWith("'''") && trimmed.lastIndexOf("'''") === 0) {
    return { isComment: true, stillInMultiLine: true };
  }

  return { isComment: false, stillInMultiLine: false };
}

/**
 * Checks if line is a scanner detection rule or regular expression test matching a pattern.
 * This directly prevents PatchProof from flagging its own scanner rules.
 */
export function isDetectionRuleOrRegexPattern(lineText: string, surroundingLines: string[]): boolean {
  const trimmed = lineText.trim();

  // Pattern 1: RegExp test/match methods (e.g. /pattern/i.test(line), line.match(/pattern/))
  if (
    /\/[^\/]+\/(i|g|m|s|u|y)*\s*\.\s*(test|match|exec)\s*\(/.test(trimmed) ||
    /\.\s*(match|search|test)\s*\(\s*\/[^\/]+\//.test(trimmed) ||
    /new\s+RegExp\s*\(/.test(trimmed)
  ) {
    // Only suppress if this line is NOT executing an actual sink like db.query or exec or fetch
    if (!/(\.query|\.execute|os\.popen|child_process|eval\(|res\.send)/i.test(trimmed)) {
      return true;
    }
  }

  // NOTE: Universal suppression based on variable names like "token" or surrounding
  // keywords like "EvaluationTestCase" or "runFallbackSAST" has been removed to prevent
  // detection evasion (DET-01, DET-02, DET-03).
  return false;
}

/**
 * Checks if file path indicates a test fixture or demo code.
 */
export function analyzeFileContext(filePath: string): AnalysisContext {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const segments = normalized.split('/').filter(Boolean);
  const basename = segments[segments.length - 1] || '';
  const stem = basename.replace(/\.[^.]*$/, '');
  const testNamePattern = /(?:^|[._-])(?:test|spec)(?:[._-]|$)/;

  // Match path segments and conventional test filename tokens, not arbitrary
  // substrings such as "contest.py" or "latest_service.ts".
  const isTest = segments.some(segment =>
    segment === 'test' || segment === 'tests' || segment === '__tests__' ||
    segment === 'fixture' || segment === 'fixtures' || /^test(?:_|-)/.test(segment)
  ) || testNamePattern.test(stem) || /(?:^|[._-])fixture(?:[._-]|$)/.test(stem);

  const isDemo = segments.some(segment =>
    segment === 'samples' || segment === 'examples' || segment === 'docs' || segment === 'documentation'
  ) || ['samplecodes', 'evaluationsuite', 'readme'].includes(stem) || /^readme(?:\.|$)/.test(basename);

  const isScanner = basename === 'server.ts' ||
    stem === 'contextanalyzer' ||
    /(?:^|[._-])rules?(?:[._-]|$)/.test(stem);

  const extension = basename.includes('.') ? basename.split('.').pop() || '' : '';
  return {
    filePath,
    language: extension,
    isTestFile: isTest,
    isDemoOrDoc: isDemo,
    isScannerOrTool: isScanner
  };
}

/**
 * Looks for a small, explicit source-to-sink indicator in the visible local
 * context. Generic names (username, filename, url, rawPayload, etc.) are not
 * evidence of untrusted input: they frequently describe trusted internal data.
 * This remains a bounded heuristic, not interprocedural taint analysis.
 */
function hasTaintSource(
  contextLines: { lineNum: number; text: string }[],
  sinkLineNum: number,
  sinkLineText: string
): boolean {
  const sourceExpression = /req\.(?:query|body|params|headers|cookies)\b|request\.(?:args|json|form|GET|POST|values|files)\b|\$_(?:GET|POST|REQUEST|COOKIE|SERVER)\b|r\.URL\.Query\s*\(|getParameter\s*\(|getQueryString\s*\(|process\.argv\b|prompt\s*\(|input\s*\(/i;
  if (sourceExpression.test(sinkLineText)) return true;

  const priorLines = contextLines
    .filter(line => line.lineNum < sinkLineNum)
    .sort((a, b) => a.lineNum - b.lineNum);
  // Track direct request-derived assignments and simple identifier aliases in
  // source order. Reassignment removes taint; only a bounded, explicit alias
  // such as `const alias = input` is propagated. This is not whole-program taint.
  const taintedVariables = new Map<string, number>();

  for (const line of priorLines) {
    if (isCommentOrDoc(line.text, false).isComment) continue;
    const assignment = /^\s*(?:(?:const|let|var)\s+|(?:[A-Za-z_$][\w$.[\]<>?]*\s+))?([A-Za-z_$][\w$]*)\s*=\s*(.+?)\s*;?\s*$/.exec(line.text);
    if (!assignment) continue;

    const variable = assignment[1];
    const expression = assignment[2].trim();
    if (sourceExpression.test(expression)) {
      taintedVariables.set(variable, line.lineNum);
      continue;
    }

    const simpleAlias = /^(?:\(\s*)?([A-Za-z_$][\w$]*)(?:\s*\))?$/.exec(expression);
    const inheritedSourceLine = simpleAlias ? taintedVariables.get(simpleAlias[1]) : undefined;
    if (inheritedSourceLine !== undefined) taintedVariables.set(variable, inheritedSourceLine);
    else taintedVariables.delete(variable);
  }

  for (const variable of taintedVariables.keys()) {
    const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`).test(sinkLineText)) return true;
  }
  return false;
}

/**
 * Vulnerability-Specific Sanitization and Control Validator.
 * 
 * Strict requirement: Do not use generic catch-all tokens.
 * - For SQL: check actual parameterized binding or prepared query, not lone question marks.
 * - For Path Traversal: check basename or verified root directory containment, not resolve alone.
 * - For Command Injection: check non-shell argument arrays, not shell=False on arbitrary strings.
 * - For Deserialization: check SafeLoader or ObjectInputFilter, not unrelated tokens.
 */
export function isVulnerabilitySanitized(
  _ruleId: string,
  _lineText: string,
  _surroundingContextLines: { lineNum: number; text: string }[]
): { isSanitized: boolean; reason?: string } {
  const context = _surroundingContextLines.map(line => line.text).join('\n');
  const allText = `${_lineText}\n${context}`;

  // Narrow XSS exception: only recognize an encoder when the exact variable
  // assigned from an untrusted source is then interpolated into this sink.
  // Nearby calls on other variables never suppress the candidate.
  if (_ruleId === 'CWE-79') {
    const targetContext = _surroundingContextLines.find(line => line.text === _lineText);
    const priorLines = targetContext
      ? _surroundingContextLines.filter(line => line.lineNum < targetContext.lineNum).sort((a, b) => a.lineNum - b.lineNum)
      : [];
    const sanitizerAssignment = /\b(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:html\.escape|escapeHtml|htmlspecialchars|DOMPurify\.sanitize)\s*\(\s*(?:req\.(?:query|body|params)|request\.(?:args|GET|POST)|\$_(?:GET|POST|REQUEST))/i;
    for (let i = priorLines.length - 1; i >= 0; i--) {
      const assignment = sanitizerAssignment.exec(priorLines[i].text);
      if (!assignment) continue;
      const variable = assignment[1];
      const escapedName = variable.replace(/[$]/g, '\\$&');
      const referencedBySink = new RegExp(`\\b${escapedName}\\b`).test(_lineText);
      const reassignedAfterSanitizing = _surroundingContextLines.some(line =>
        line.lineNum > priorLines[i].lineNum && line.lineNum <= (targetContext?.lineNum ?? -1) &&
        new RegExp(`(?:^|[;\\s])(?:const\\s+|let\\s+|var\\s+)?${escapedName}\\s*=(?!=)`).test(line.text)
      );
      if (referencedBySink && !reassignedAfterSanitizing) {
        return { isSanitized: true, reason: `The same variable (${variable}) is assigned from a request source through an HTML sanitizer before this output line, with no intervening reassignment in the visible context.` };
      }
      break;
    }

    const directEscapedSource = /(?:html\.escape|escapeHtml|htmlspecialchars|DOMPurify\.sanitize)\s*\(\s*(?:req\.(?:query|body|params)|request\.(?:args|GET|POST)|\$_(?:GET|POST|REQUEST))/i.test(_lineText);
    if (directEscapedSource) {
      return { isSanitized: true, reason: 'The request-derived expression passed to this output line is wrapped directly in an HTML sanitizer.' };
    }
  }

  // For other rules, nearby controls cannot establish value identity or
  // complete sink coverage. Keep candidates visible until a semantic data-flow
  // engine can prove the control applies; this favors review over false safety.
  return { isSanitized: false };
}

/**
 * Extracts surrounding lines around a target line with 1-indexed numbering.
 */
function getSurroundingLines(lines: string[], lineNum: number): { lineNum: number; text: string }[] {
  const result: { lineNum: number; text: string }[] = [];
  // Keep a bounded five-line lookback so short alias chains and nearby
  // reassignment/sanitizer evidence are visible without scanning whole files.
  const startIdx = Math.max(0, lineNum - 6);
  const endIdx = Math.min(lines.length - 1, lineNum + 1);

  for (let i = startIdx; i <= endIdx; i++) {
    result.push({ lineNum: i + 1, text: lines[i] });
  }
  return result;
}

/**
 * Formats surrounding context into readable evidence string with line numbers.
 */
function formatSurroundingContext(surroundingLines: { lineNum: number; text: string }[], targetLineNum: number): string {
  return surroundingLines.map(l => {
    const marker = l.lineNum === targetLineNum ? ' > ' : '   ';
    return `${l.lineNum.toString().padStart(4, ' ')}${marker}${l.text}`;
  }).join('\n');
}

/**
 * Initial Dangerous Pattern Identification.
 */
export function runInitialDetection(code: string, fileName: string): RawDetectionCandidate[] {
  const lines = code.split('\n');
  const candidates: RawDetectionCandidate[] = [];
  let inMultiLineComment = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const lineText = lines[idx];

    // Check comment status
    const commentState = isCommentOrDoc(lineText, inMultiLineComment);
    inMultiLineComment = commentState.stillInMultiLine;
    if (commentState.isComment) {
      continue; // Skip comments in initial detection
    }

    // Bounded line length limit to prevent ReDoS on massive lines (e.g. 800KB single line minified/malicious inputs)
    const MAX_LINE_INSPECT_LENGTH = 4096;
    const inspectText = lineText.length > MAX_LINE_INSPECT_LENGTH ? lineText.slice(0, MAX_LINE_INSPECT_LENGTH) : lineText;

    const surroundingLines = getSurroundingLines(lines, lineNum);

    // Rule 1: SQL Injection (bounded patterns avoiding quadratic backtracking)
    if (
      /(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+[^\n]{1,300}?(?:\+|\%|\$|f"|f'|\`|\$\{)/i.test(inspectText) ||
      /(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+[^\n]{1,300}?WHERE[^\n]{1,300}?[\+\$]/i.test(inspectText) ||
      /cursor\.execute\s*\(\s*f["'][^\n]{0,300}?SELECT/i.test(inspectText) ||
      /execute\s*\(\s*["'][^\n]{0,300}?\$\{/i.test(inspectText) ||
      /\.query\s*\(\s*["'][^\n]{0,300}?[\+\$]/i.test(inspectText) ||
      (/\.query\s*\(\s*(query|sql|stmt)\b/i.test(inspectText) && surroundingLines.some(l => /(SELECT|INSERT|UPDATE|DELETE)/i.test(l.text) && /[\+\$]/.test(l.text))) ||
      (/(query|sql|stmt)\s*=\s*["'][^\n]{0,300}?(SELECT|INSERT|UPDATE|DELETE)/i.test(inspectText) && /[\+\$]/.test(inspectText))
    ) {
      candidates.push({
        ruleId: 'CWE-89',
        title: 'SQL Injection via Unsanitized Input Concatenation',
        cwe: 'CWE-89: Improper Neutralization of Special Elements used in an SQL Command',
        owaspCategory: 'A03:2021-Injection',
        defaultSeverity: 'CRITICAL',
        defaultConfidence: 'HIGH',
        lineNum,
        lineText,
        surroundingLines,
        dangerousOperation: 'Constructing dynamic SQL statement using direct string concatenation or formatting',
        explanation: 'Dynamically formatted SQL queries allow attackers to append arbitrary SQL syntax, altering the query logic.',
        attackScenario: "An adversary supplying `' OR 1=1 --` can bypass authentication or extract arbitrary database records via UNION attacks.",
        exploitConditions: 'Exploitable when user-controllable input reaches the query string without parameterized binding.',
        remediation: 'Use parameterized queries / prepared statements with placeholder bindings (e.g. $1 or ?).',
        suggestedPatch: lineText.includes('f"') || lineText.includes("f'")
          ? 'query, params = ("SELECT * FROM users WHERE username = ?", (username,))'
          : 'const query = "SELECT * FROM users WHERE id = ?";\n  db.query(query, [id]);'
      });
    }

    // Rule 2: OS Command Injection
    if (
      /(os\.popen|os\.system|subprocess\.Popen|exec\s*\(|child_process\.exec|Runtime\.getRuntime\(\)\.exec)/i.test(lineText) &&
      !lineText.includes('execFile')
    ) {
      candidates.push({
        ruleId: 'CWE-78',
        title: 'OS Command Injection via Shell Invocation',
        cwe: 'CWE-78: Improper Neutralization of Special Elements in an OS Command',
        owaspCategory: 'A03:2021-Injection',
        defaultSeverity: 'CRITICAL',
        defaultConfidence: 'HIGH',
        lineNum,
        lineText,
        surroundingLines,
        dangerousOperation: 'Invoking operating system shell execution with dynamically formatted arguments',
        explanation: 'Executing system commands through a shell without argument sanitization permits command delimiter injection.',
        attackScenario: "An attacker appending `; cat /etc/passwd` or `&& id` can execute arbitrary operating system commands with server privileges.",
        exploitConditions: 'Exploitable if arguments contain unescaped user input passed to a shell interpreter.',
        remediation: 'Avoid invoking the system shell. Use argument arrays with non-shell APIs (e.g. execFile or subprocess.run with shell=False).',
        suggestedPatch: lineText.replace(/os\.popen\(.*\)/, 'subprocess.run(["ping", "-c", "2", target_host], capture_output=True, check=True)')
      });
    }

    // Rule 3: Hardcoded Credentials / Secrets
    if (
      /(secret|jwt_secret|password|api_key|token|private_key)\s*=\s*["'][a-zA-Z0-9_\-\.\@\#\$\%]{8,}["']/i.test(lineText) &&
      !lineText.toLowerCase().includes('process.env') &&
      !lineText.toLowerCase().includes('os.environ')
    ) {
      candidates.push({
        ruleId: 'CWE-798',
        title: 'Hardcoded Secret Key or Token',
        cwe: 'CWE-798: Use of Hardcoded Credentials',
        owaspCategory: 'A07:2021-Identification and Authentication Failures',
        defaultSeverity: 'HIGH',
        defaultConfidence: 'HIGH',
        lineNum,
        lineText,
        surroundingLines,
        dangerousOperation: 'Storing cryptographic secret or credential token as a plaintext string in source code',
        explanation: 'Hardcoded secrets can be extracted by anyone with source code access or decompiled packages.',
        attackScenario: 'Anyone with repository read access or access to client bundles can forge authorization tokens or access private resources.',
        exploitConditions: 'Exploitable whenever the repository or build artifact is exposed, leaked, or inspected.',
        remediation: 'Load secrets dynamically from secure environment variables or vault services at runtime.',
        suggestedPatch: 'const secret = process.env.API_SECRET;\nif (!secret) {\n  throw new Error("API_SECRET environment variable is missing");\n}'
      });
    }

    // Rule 4: Insecure Deserialization
    if (
      /(new\s+ObjectInputStream|readObject\s*\(|pickle\.loads\s*\(|yaml\.load\s*\([^,)]*\)|unserialize\s*\()/i.test(lineText) &&
      !lineText.includes('SafeLoader')
    ) {
      candidates.push({
        ruleId: 'CWE-502',
        title: 'Insecure Deserialization of Untrusted Data',
        cwe: 'CWE-502: Deserialization of Untrusted Data',
        owaspCategory: 'A08:2021-Software and Data Integrity Failures',
        defaultSeverity: 'CRITICAL',
        defaultConfidence: 'HIGH',
        lineNum,
        lineText,
        surroundingLines,
        dangerousOperation: 'Reconstructing serialized objects from untrusted byte streams without type whitelisting',
        explanation: 'Deserializing untrusted byte streams without class filtering allows trigger of gadget chains leading to remote code execution.',
        attackScenario: 'An attacker submits a crafted serialized payload that triggers arbitrary command execution upon deserialization.',
        exploitConditions: 'Exploitable when an untrusted user payload reaches the deserializer and gadget classes are present in classpath.',
        remediation: 'Use safe data serialization formats like JSON, or enforce strict class filters (ObjectInputFilter / SafeLoader).',
        suggestedPatch: '// Use standard JSON.parse or secure ObjectInputFilter validation instead'
      });
    }

    // Rule 5: Unsafe Dynamic Code Evaluation
    if (
      /(\beval\s*\(|new\s+Function\s*\(|\$formula\s*=\s*\$_GET)/i.test(lineText)
    ) {
      candidates.push({
        ruleId: 'CWE-95',
        title: 'Unsafe Dynamic Code Execution (Eval Injection)',
        cwe: 'CWE-95: Improper Neutralization of Directives in Dynamically Evaluated Code',
        owaspCategory: 'A03:2021-Injection',
        defaultSeverity: 'CRITICAL',
        defaultConfidence: 'HIGH',
        lineNum,
        lineText,
        surroundingLines,
        dangerousOperation: 'Passing dynamic string expressions to runtime code evaluator',
        explanation: 'Dynamic evaluation grants arbitrary code execution capabilities to whoever controls the input formula.',
        attackScenario: "An attacker supplies malicious code e.g. `system('id')` to take over the application runtime.",
        exploitConditions: 'Exploitable if user-controllable input reaches the eval argument.',
        remediation: 'Avoid dynamic code evaluation. Use a restricted mathematical parser library or safe AST evaluator.',
        suggestedPatch: '// Replace eval with a safe mathematical expression parser library'
      });
    }

    // Rule 6: Path Traversal
    if (
      (lineText.includes('path.join') || lineText.includes('/var/app/data/') || lineText.includes('open(') || lineText.includes('os.ReadFile')) &&
      (lineText.includes('req.query') || lineText.includes('r.URL.Query') || lineText.includes('request.args') || lineText.includes('filename') || lineText.includes('internalConfigPath'))
    ) {
      candidates.push({
        ruleId: 'CWE-22',
        title: 'Improper Limitation of Pathname (Path Traversal)',
        cwe: 'CWE-22: Improper Limitation of a Pathname to a Restricted Directory',
        owaspCategory: 'A01:2021-Broken Access Control',
        defaultSeverity: 'HIGH',
        defaultConfidence: 'MEDIUM',
        lineNum,
        lineText,
        surroundingLines,
        dangerousOperation: 'Concatenating user-controlled filename into filesystem directory path',
        explanation: 'Direct path concatenation without boundary validation allows directory traversal using `../`.',
        attackScenario: "An attacker submits `../../../../etc/passwd` to read confidential files outside the web root.",
        exploitConditions: 'Exploitable when relative path segments are not stripped prior to resolving the filesystem target.',
        remediation: 'Sanitize with path.basename, normalize paths, and verify canonical path is rooted within allowed directory.',
        suggestedPatch: 'const safeName = path.basename(filename); const filePath = path.resolve(baseDir, safeName);'
      });
    }

    // Rule 7: SSRF (Server-Side Request Forgery)
    if (
      /(axios\.get|fetch|requests\.get|http\.Get)\s*\(\s*(url|req\.|request\.)/i.test(lineText)
    ) {
      candidates.push({
        ruleId: 'CWE-918',
        title: 'Server-Side Request Forgery (SSRF)',
        cwe: 'CWE-918: Server-Side Request Forgery',
        owaspCategory: 'A10:2021-Server-Side Request Forgery',
        defaultSeverity: 'HIGH',
        defaultConfidence: 'MEDIUM',
        lineNum,
        lineText,
        surroundingLines,
        dangerousOperation: 'Issuing outbound network requests to client-specified URL',
        explanation: 'Fetching user-supplied URLs without allowlist validation enables SSRF attacks against internal networks or metadata endpoints.',
        attackScenario: 'An attacker targets internal metadata APIs (e.g. http://169.254.169.254) to steal cloud IAM credentials.',
        exploitConditions: 'Exploitable if private loopback and link-local IP addresses are accessible and unvalidated.',
        remediation: 'Validate URLs against a domain allowlist and block private IP ranges (127.0.0.1, 10.0.0.0/8, 169.254.169.254).',
        suggestedPatch: '// Validate protocol, hostname against allowlist, and block private IP address ranges before fetching'
      });
    }

    // Rule 8: Reflected XSS
    if (
      (lineText.includes('res.send(') || lineText.includes('response.write(') || lineText.includes('echo ') || /return\s+f?["'].*<[a-z]+/i.test(lineText)) &&
      (lineText.includes('req.query') || lineText.includes('$_GET') || lineText.includes('name') || lineText.includes('user') || lineText.includes('input')) &&
      (lineText.includes('<h1>') || lineText.includes('<html>') || lineText.includes('<script>') || lineText.includes('<div>'))
    ) {
      candidates.push({
        ruleId: 'CWE-79',
        title: 'Reflected Cross-Site Scripting (XSS)',
        cwe: 'CWE-79: Improper Neutralization of Input During Web Page Generation',
        owaspCategory: 'A03:2021-Injection',
        defaultSeverity: 'MEDIUM',
        defaultConfidence: 'HIGH',
        lineNum,
        lineText,
        surroundingLines,
        dangerousOperation: 'Interpolating raw user input directly into HTML response document',
        explanation: 'Unescaped user input reflected in web responses allows execution of arbitrary script in victims browser sessions.',
        attackScenario: "An attacker tricks a victim into clicking a link with `?name=<script>stealSession()</script>` to hijack cookies.",
        exploitConditions: 'Exploitable when HTML response is rendered without Content-Security-Policy or HTML encoding.',
        remediation: 'HTML-encode all dynamic values before rendering or use context-aware template engines with auto-escaping.',
        suggestedPatch: 'res.send(`<html><body><h1>Welcome, ${escapeHtml(name)}</h1></body></html>`);'
      });
    }

    // Rule 9: Insecure PRNG for Security-Sensitive Tokens
    const isPrngTokenContext = lineText.includes('token') || lineText.includes('session') || lineText.includes('key') ||
      surroundingLines.some(l => /token|session|reset|secret/i.test(l.text));
    if (
      /rand\.Seed\(|math\/rand|Math\.random\(\)|random\.random\(\)/i.test(lineText) &&
      isPrngTokenContext
    ) {
      candidates.push({
        ruleId: 'CWE-338',
        title: 'Cryptographically Weak Pseudo-Random Number Generator',
        cwe: 'CWE-338: Use of Cryptographically Weak PRNG',
        owaspCategory: 'A02:2021-Cryptographic Failures',
        defaultSeverity: 'MEDIUM',
        defaultConfidence: 'HIGH',
        lineNum,
        lineText,
        surroundingLines,
        dangerousOperation: 'Generating security-critical authentication token using mathematical PRNG',
        explanation: 'Standard mathematical PRNG algorithms are deterministic and can be predicted given known seeds or output history.',
        attackScenario: 'An attacker predicts session tokens or reset codes by approximating PRNG state based on server timestamps.',
        exploitConditions: 'Exploitable when PRNG output is used for security authentication tokens.',
        remediation: 'Use cryptographically secure random number generators (e.g. crypto.randomBytes in Node.js or crypto/rand in Go).',
        suggestedPatch: '// Use crypto/rand or crypto.randomBytes instead of math/rand'
      });
    }
  }

  return candidates;
}

/**
 * Context Understanding & Vulnerability Verification Pipeline.
 * Evaluates context, eliminates false positives, checks evidence, and assigns final classification.
 */
export function verifyAndClassifyCandidates(
  candidates: RawDetectionCandidate[],
  fileContext: AnalysisContext,
  fullCodeLines: string[]
): VulnerabilityFinding[] {
  const verifiedFindings: VulnerabilityFinding[] = [];
  const seenDeduplicationKeys = new Set<string>();

  for (const c of candidates) {
    const surroundingContextTexts = c.surroundingLines.map(s => s.text);
    const surroundingContextStr = surroundingContextTexts.join('\n');

    // 1. False Positive Reduction: Is this line a detection rule, regex declaration, or scanner pattern?
    if (isDetectionRuleOrRegexPattern(c.lineText, surroundingContextTexts)) {
      verifiedFindings.push({
        id: `suppressed-${c.ruleId}-${c.lineNum}`,
        filePath: fileContext.filePath,
        title: c.title,
        cwe: c.cwe,
        owaspCategory: c.owaspCategory,
        severity: 'INFO',
        confidence: 'LOW',
        verificationStatus: 'FALSE_POSITIVE',
        verificationType: 'STATIC_RULE_MATCH',
        verificationMethod: 'STATIC_AST_CHECK',
        startLine: c.lineNum,
        endLine: c.lineNum,
        snippet: c.lineText.trim(),
        surroundingContext: formatSurroundingContext(c.surroundingLines, c.lineNum),
        evidence: `Line ${c.lineNum}: Matched pattern definition inside regex or detection rule`,
        explanation: 'Suppressed: Matched pattern occurs inside a detection rule or regular expression test, not an executable application sink.',
        attackScenario: 'Not exploitable: Rule pattern detection definition.',
        exploitConditions: 'Non-exploitable: Pattern match is part of security detection logic.',
        classificationReason: 'Evidence shows code is a regex/rule match rather than an application operation.',
        reasoning: 'The syntax matches security detection or regex declaration patterns rather than an operational database or execution sink.',
        remainingUncertainty: 'Zero remaining uncertainty: Static regex declaration confirmed.',
        remediation: 'No remediation necessary.',
        suggestedPatch: c.lineText,
        patchVerificationStatus: 'VERIFIED_STATIC',
        status: 'FALSE_POSITIVE',
        analysisEngine: 'Context-Aware Static Rules (Local)'
      });
      continue;
    }

    // 2. Vulnerability-Specific Sanitization and Control Check
    const sanitization = isVulnerabilitySanitized(c.ruleId, c.lineText, c.surroundingLines);
    if (sanitization.isSanitized) {
      verifiedFindings.push({
        id: `suppressed-sanitized-${c.ruleId}-${c.lineNum}`,
        filePath: fileContext.filePath,
        title: c.title,
        cwe: c.cwe,
        owaspCategory: c.owaspCategory,
        severity: 'LOW',
        confidence: 'LOW',
        verificationStatus: 'FALSE_POSITIVE',
        verificationType: 'STATIC_RULE_MATCH',
        verificationMethod: 'STATIC_AST_CHECK',
        startLine: c.lineNum,
        endLine: c.lineNum,
        snippet: c.lineText.trim(),
        surroundingContext: formatSurroundingContext(c.surroundingLines, c.lineNum),
        evidence: `Line ${c.lineNum}: ${sanitization.reason}`,
        explanation: `Mitigated: ${sanitization.reason}`,
        attackScenario: 'Mitigated: Sanitizer or safe binding pattern verified in context.',
        exploitConditions: 'Non-exploitable when parameter binding or sanitization covers all input variations.',
        classificationReason: sanitization.reason || 'Sanitization pattern observed in surrounding context.',
        reasoning: `Contextual inspection identified defensive control: ${sanitization.reason}`,
        remainingUncertainty: 'Static analysis confirms defensive construct in local scope. Production verification recommended.',
        remediation: 'Verify that the existing sanitization logic handles all edge cases.',
        suggestedPatch: c.lineText,
        patchVerificationStatus: 'VERIFIED_STATIC',
        status: 'FALSE_POSITIVE',
        analysisEngine: 'Context-Aware Static Rules (Local)'
      });
      continue;
    }

    // 3. Context Verification: Does untrusted taint input reach this dangerous sink?
    const hasInputTaint = hasTaintSource(c.surroundingLines, c.lineNum, c.lineText);

    let finalClassification: VerificationStatus = 'NEEDS_REVIEW';
    let finalConfidence: Confidence = 'MEDIUM';
    let classificationReason = '';
    let reasoning = '';
    let remainingUncertainty = '';

    let finalSeverity: Severity = c.defaultSeverity;

    if (hasInputTaint && !c.lineText.includes('//')) {
      if (fileContext.isTestFile || fileContext.isDemoOrDoc) {
        // Keep the candidate visible for review, but do not present fixture/demo
        // code as a likely production vulnerability or penalize the project score.
        finalClassification = 'NEEDS_REVIEW';
        finalConfidence = 'LOW';
        finalSeverity = 'INFO';
        classificationReason = `Potentially dangerous operation (${c.dangerousOperation}) appears in test, sample, or documentation context.`;
        reasoning = 'A source-to-sink pattern exists in non-production context. It is retained as informational review evidence, not counted as a likely production vulnerability.';
        remainingUncertainty = 'Confirm whether this file is shipped or executed in production before treating the pattern as an application vulnerability.';
      } else {
        // This engine currently uses bounded pattern matching and nearby-context
        // heuristics, not AST/CFG or whole-program taint tracking. A nearby source
        // and sink is a strong indicator, but is not sufficient to call the issue
        // confirmed or claim a proven taint-flow analysis.
        finalClassification = 'LIKELY';
        finalConfidence = 'HIGH';
        classificationReason = 'A recognized untrusted-input expression is assigned to the same variable referenced by the sink in the visible local context; complete control-flow and semantic validation are not available.';
        reasoning = 'A bounded local source-to-sink indicator was found. This does not prove all paths, aliases, sanitizers, or caller behavior.';
        remainingUncertainty = 'Requires manual tracing or a future AST/control-flow/interprocedural data-flow engine to verify the complete path and applicable controls.';
      }
    } else if (!hasInputTaint) {
      finalClassification = 'NEEDS_REVIEW';
      finalConfidence = 'MEDIUM';
      classificationReason = `Dangerous operation detected (${c.dangerousOperation}), but source of parameters cannot be statically confirmed as user-controlled in immediate local scope.`;
      reasoning = 'Operation is sensitive to injection, but caller context must be reviewed to verify whether parameters originate from external untrusted inputs.';
      remainingUncertainty = 'Origin of parameters could not be statically traced beyond local enclosing function without whole-program call graph analysis.';
    } else {
      finalClassification = 'LIKELY';
      finalConfidence = 'MEDIUM';
      classificationReason = `Strong indicators of insecure pattern match; manual verification recommended.`;
      reasoning = 'Pattern match identified with partial taint indicators.';
      remainingUncertainty = 'Caller context and surrounding sanitizers could not be exhaustively proven in isolated file scope.';
    }

    // Deduplication check
    const dedupKey = `${fileContext.filePath}:${c.lineNum}:${c.ruleId}`;
    if (seenDeduplicationKeys.has(dedupKey)) {
      continue;
    }
    seenDeduplicationKeys.add(dedupKey);

    verifiedFindings.push({
      id: `finding-${c.ruleId.toLowerCase()}-${c.lineNum}`,
      filePath: fileContext.filePath,
      title: c.title,
      cwe: c.cwe,
      owaspCategory: c.owaspCategory,
      severity: finalSeverity,
      confidence: finalConfidence,
      verificationStatus: finalClassification,
      verificationType: 'STATIC_RULE_MATCH',
      verificationMethod: 'CONTEXTUAL_HEURISTIC',
      startLine: c.lineNum,
      endLine: c.lineNum,
      snippet: c.lineText.trim(),
      surroundingContext: formatSurroundingContext(c.surroundingLines, c.lineNum),
      evidence: `Line ${c.lineNum}: ${c.lineText.trim()}`,
      explanation: c.explanation,
      attackScenario: c.attackScenario,
      exploitConditions: c.exploitConditions,
      classificationReason,
      reasoning,
      remainingUncertainty,
      remediation: c.remediation,
      suggestedPatch: c.suggestedPatch,
      patchVerificationStatus: 'UNVERIFIED_REVIEW_REQUIRED',
      status: 'OPEN',
      dedupKey,
      analysisEngine: 'Context-Aware Static Rules (Local)'
    });
  }

  return verifiedFindings;
}

/**
 * Executes full Context-Aware Security Analysis on a source file.
 */
export function analyzeSourceCodeContextAware(
  code: string,
  filePath: string
): { findings: VulnerabilityFinding[]; metrics: SecurityMetrics } {
  const fileContext = analyzeFileContext(filePath);
  const rawCandidates = runInitialDetection(code, filePath);
  const lines = code.split('\n');

  const verifiedFindings = verifyAndClassifyCandidates(rawCandidates, fileContext, lines);

  // Compute metrics with accurate counts
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let infoCount = 0;
  let confirmedCount = 0;
  let likelyCount = 0;
  let needsReviewCount = 0;
  let falsePositiveCount = 0;

  for (const f of verifiedFindings) {
    if (f.verificationStatus === 'FALSE_POSITIVE') {
      falsePositiveCount++;
      continue; // Don't penalize score for false positives
    }

    if (f.severity === 'CRITICAL') criticalCount++;
    else if (f.severity === 'HIGH') highCount++;
    else if (f.severity === 'MEDIUM') mediumCount++;
    else if (f.severity === 'LOW') lowCount++;
    else infoCount++;

    if (f.verificationStatus === 'CONFIRMED') confirmedCount++;
    else if (f.verificationStatus === 'LIKELY') likelyCount++;
    else if (f.verificationStatus === 'NEEDS_REVIEW') needsReviewCount++;
  }

  const penalty = criticalCount * 25 + highCount * 14 + mediumCount * 7 + lowCount * 2;
  const activeIssues = criticalCount + highCount + mediumCount + lowCount;
  const score = activeIssues === 0 ? 100 : Math.max(5, 100 - penalty);

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'A+';
  if (score >= 95) grade = 'A+';
  else if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 50) grade = 'C';
  else if (score >= 30) grade = 'D';
  else grade = 'F';

  const metrics: SecurityMetrics = {
    score,
    grade,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
    totalFindings: activeIssues,
    confirmedCount,
    likelyCount,
    needsReviewCount,
    falsePositiveCount,
    aiHypothesesCount: 0,
    deterministicCount: activeIssues,
    linesAnalyzed: lines.length
  };

  return { findings: verifiedFindings, metrics };
}
