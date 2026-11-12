/**
 * Maps known Express/body-parser request failures to small, safe API responses.
 * Never include parser messages, request bodies, or stack traces in client output.
 */
export interface SafeRequestError {
  statusCode: 400 | 413 | 415;
  message: string;
}

export function classifyRequestBodyError(error: unknown): SafeRequestError | null {
  if (!error || typeof error !== 'object') return null;

  const candidate = error as { type?: unknown; status?: unknown; statusCode?: unknown };
  const type = typeof candidate.type === 'string' ? candidate.type : '';
  const status = candidate.statusCode ?? candidate.status;

  if (type === 'entity.too.large' || status === 413) {
    return { statusCode: 413, message: 'Request body exceeds the permitted size.' };
  }

  if (type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'Request body contains invalid JSON.' };
  }

  if (type === 'encoding.unsupported' || type === 'charset.unsupported') {
    return { statusCode: 415, message: 'Request body encoding is not supported.' };
  }

  if (type === 'request.aborted') {
    return { statusCode: 400, message: 'Request body was not received completely.' };
  }

  return null;
}
