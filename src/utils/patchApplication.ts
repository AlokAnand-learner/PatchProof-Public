/**
 * Apply a source-snippet patch only when its validation and target evidence are current.
 * This helper performs a pure string transformation; it never writes files or executes code.
 */
export interface SnippetPatchInput {
  startLine: number;
  endLine: number;
  snippet: string;
  suggestedPatch: string;
}

export type SnippetPatchResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'validation-required' | 'empty-patch' | 'invalid-range' | 'stale-source' };

/**
 * The caller must still obtain explicit user approval before persisting the returned code.
 * Only the exact VALIDATED state is eligible; partial and unreviewed fixes fail closed.
 */
export function applyValidatedSnippetPatch(
  originalCode: string,
  finding: SnippetPatchInput,
  validationStatus: string,
): SnippetPatchResult {
  if (validationStatus !== 'VALIDATED') return { ok: false, reason: 'validation-required' };
  if (typeof finding.suggestedPatch !== 'string' || finding.suggestedPatch.trim().length === 0) {
    return { ok: false, reason: 'empty-patch' };
  }

  const lines = originalCode.split('\n');
  const { startLine, endLine } = finding;
  if (
    !Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) ||
    startLine < 1 || endLine < startLine || endLine > lines.length ||
    endLine - startLine > 200
  ) {
    return { ok: false, reason: 'invalid-range' };
  }

  const startIndex = startLine - 1;
  const endIndex = endLine;
  const currentSnippet = lines.slice(startIndex, endIndex).join('\n');
  if (typeof finding.snippet !== 'string' || finding.snippet.length === 0 || currentSnippet !== finding.snippet) {
    return { ok: false, reason: 'stale-source' };
  }

  lines.splice(startIndex, endIndex - startIndex, ...finding.suggestedPatch.split('\n'));
  return { ok: true, code: lines.join('\n') };
}
