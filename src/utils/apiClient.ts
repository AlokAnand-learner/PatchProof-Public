/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let cachedSessionToken: string | null = null;

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
  } catch (err) {
    console.error('Failed to obtain session token:', err);
  }

  return '';
}

/**
 * Performs an authenticated fetch with the single-user session token.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getSessionToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('X-PatchProof-Auth', token);
  }

  return fetch(url, {
    ...options,
    headers
  });
}
