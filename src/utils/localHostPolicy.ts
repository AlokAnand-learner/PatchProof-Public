/**
 * Local-only host/origin policy for the single-user PatchProof development server.
 * This deliberately rejects LAN, container-preview, and arbitrary custom hosts.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isAllowedLocalHostHeader(rawHost: unknown): boolean {
  if (typeof rawHost !== 'string' || rawHost.length === 0 || rawHost.length > 255) return false;
  if (rawHost === '::1') return true; // Node listen() accepts an unbracketed IPv6 bind address.
  try {
    // URL parsing correctly handles bracketed IPv6 authorities and optional ports.
    const parsed = new URL(`http://${rawHost}`);
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return false;
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return LOOPBACK_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

export function isAllowedLocalOrigin(rawOrigin: unknown): boolean {
  if (typeof rawOrigin !== 'string' || rawOrigin.length === 0 || rawOrigin.length > 2048) return false;
  try {
    const origin = new URL(rawOrigin);
    if (origin.protocol !== 'http:' && origin.protocol !== 'https:') return false;
    if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return false;
    return LOOPBACK_HOSTS.has(origin.hostname.toLowerCase().replace(/^\[|\]$/g, ''));
  } catch {
    return false;
  }
}
