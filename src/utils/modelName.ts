/** Validate and normalize a model identifier supplied through the API/UI. */
export function normalizeModelName(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('Model name must be a string of at most 128 characters without control characters.');
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
