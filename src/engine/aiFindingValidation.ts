/**
 * Treat model-generated findings as untrusted suggestions.
 * Model labels never establish independent verification, and source locations
 * must be valid integer line ranges for the exact file being reviewed.
 */
export type SafeAISeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type SafeAIConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SafeAIModelFinding {
  title: string;
  cwe: string;
  owaspCategory: string;
  severity: SafeAISeverity;
  confidence: SafeAIConfidence;
  startLine: number;
  endLine: number;
  snippet: string;
  explanation: string;
  attackScenario: string;
  exploitConditions: string;
  remediation: string;
  suggestedPatch: string;
}

const SEVERITIES = new Set<SafeAISeverity>(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
const CONFIDENCES = new Set<SafeAIConfidence>(['HIGH', 'MEDIUM', 'LOW']);
const MAX_FINDINGS = 100;
const MAX_TEXT = 4000;

function boundedText(value: unknown, fallback: string, max = MAX_TEXT): string {
  if (typeof value !== 'string') return fallback;
  return value.replace(/\u0000/g, '').trim().slice(0, max) || fallback;
}

/** Returns only well-formed findings with source-grounded line ranges. */
export function validateAIModelFindings(raw: unknown, sourceCode: string): SafeAIModelFinding[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const lines = sourceCode.split('\n');
  const lineCount = lines.length;
  const validated: SafeAIModelFinding[] = [];

  for (const item of raw.slice(0, MAX_FINDINGS)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const f = item as Record<string, unknown>;
    const startLine = f.startLine;
    const endLine = f.endLine;

    // Reject rather than clamp: clamping can make a fabricated location look valid.
    if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine)) continue;
    const start = startLine as number;
    const end = endLine as number;
    if (start < 1 || end < start || end > lineCount || end - start > 200) continue;

    const rawSeverity = typeof f.severity === 'string' ? f.severity.toUpperCase() as SafeAISeverity : 'MEDIUM';
    const rawConfidence = typeof f.confidence === 'string' ? f.confidence.toUpperCase() as SafeAIConfidence : 'LOW';
    const severity = SEVERITIES.has(rawSeverity) ? rawSeverity : 'MEDIUM';
    const confidence = CONFIDENCES.has(rawConfidence) ? rawConfidence : 'LOW';

    validated.push({
      title: boundedText(f.title, 'Potential security weakness', 180),
      cwe: boundedText(f.cwe, 'CWE-Other', 100),
      owaspCategory: boundedText(f.owaspCategory, 'Uncategorized', 120),
      severity,
      confidence,
      startLine: start,
      endLine: end,
      // Never trust a model-supplied snippet as evidence; derive it from the source.
      snippet: lines.slice(start - 1, end).join('\n').slice(0, 8000),
      explanation: boundedText(f.explanation, 'AI-generated hypothesis; requires human review.'),
      attackScenario: boundedText(f.attackScenario, 'Potential impact requires human assessment.'),
      exploitConditions: boundedText(f.exploitConditions, 'Exploitability has not been independently verified.'),
      remediation: boundedText(f.remediation, 'Review the affected code path and apply an appropriate secure fix.'),
      suggestedPatch: boundedText(f.suggestedPatch, '', 8000),
    });
  }
  return validated;
}
