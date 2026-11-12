/**
 * Builds the application Content Security Policy for its current runtime mode.
 * Development-only eval support is never enabled in production responses.
 */
export function getContentSecurityPolicy(isDevelopment: boolean): string {
  const scriptPolicy = isDevelopment
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval';"
    : "script-src 'self';";
  // Vite HMR needs loopback WebSockets only in development. Production frontend
  // requests are same-origin; do not let a compromised page probe arbitrary local ports.
  const connectPolicy = isDevelopment
    ? "connect-src 'self' ws://localhost:* ws://127.0.0.1:* ws://[::1]:*;"
    : "connect-src 'self';";

  return [
    "default-src 'self';",
    scriptPolicy,
    "style-src 'self' 'unsafe-inline';",
    "img-src 'self' data: blob:;",
    connectPolicy,
    "font-src 'self' data:;",
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    "frame-ancestors 'none';"
  ].join(' ');
}
