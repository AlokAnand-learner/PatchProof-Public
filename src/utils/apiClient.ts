/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let cachedSessionToken: string | null = null;

/**
 * Resolve a request URL only when it stays on the PatchProof UI origin.
 * This prevents accidentally attaching the local session token to a third-party URL.
 */
export function resolveSameOriginRequestUrl(rawUrl: string, origin: string): string {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0 || rawUrl.length > 8192) {
    throw new Error('Request URL is invalid.');
  }
  let base: URL;
  let target: URL;
  try {
    base = new URL(origin);
    target = new URL(rawUrl, base);
  } catch {
    throw new Error('Request URL is invalid.');
  }
  if (!['http:', 'https:'].includes(base.protocol) || target.origin !== base.origin || target.username || target.password) {
    throw new Error('PatchProof API requests must remain on the application origin.');
  }
  return target.href;
}

/**
 * Initializes and retrieves the local single-user session token.
 */
export async function getSessionToken(): Promise<string> {
  if (cachedSessionToken) return cachedSessionToken;

  try {
    const res = await fetch('/api/auth/session');
    if (res.ok) {
      const data = await res.json();
      if (data.sessionToken) {
        cachedSessionToken = data.sessionToken;
        return data.sessionToken;
      }
    }
  } catch {
    // Authentication failure is surfaced by the protected API request itself.
  }

  return '';
}

/**
 * Performs an authenticated fetch, refusing cross-origin destinations before
 * obtaining or attaching the local session token.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (typeof window === 'undefined' || !window.location?.origin) {
    throw new Error('Authenticated API requests are available only in the PatchProof browser.');
  }
  const safeUrl = resolveSameOriginRequestUrl(url, window.location.origin);
  const token = await getSessionToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('X-PatchProof-Auth', token);
  }

  return fetch(safeUrl, {
    ...options,
    headers
  });
}
