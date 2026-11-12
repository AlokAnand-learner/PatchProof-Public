/**
 * Resource bounds for source analysis.
 *
 * Newline-dense files can create enormous arrays even when their byte size is
 * within upload limits. Count lines without allocating split() arrays first.
 */
export const MAX_SOURCE_LINES_PER_FILE = 100_000;
export const MAX_SOURCE_LINES_PER_PROJECT = 300_000;

/** Returns the number of logical lines, or null when the configured cap is exceeded. */
export function countSourceLinesWithinLimit(source: string, maxLines: number): number | null {
  if (!Number.isSafeInteger(maxLines) || maxLines < 1) return null;
  let lines = 1;
  for (let i = 0; i < source.length; i += 1) {
    if (source.charCodeAt(i) === 10) {
      lines += 1;
      if (lines > maxLines) return null;
    }
  }
  return lines;
}
