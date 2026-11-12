/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import net from 'net';

/** Parse a canonical IPv6 literal into its 128-bit integer representation. */
function ipv6ToBigInt(address: string): bigint | null {
  let input = address.toLowerCase();
  if (input.includes('.')) {
    const lastColon = input.lastIndexOf(':');
    if (lastColon < 0) return null;
    const ipv4Tail = input.slice(lastColon + 1);
    if (!net.isIPv4(ipv4Tail)) return null;
    const octets = ipv4Tail.split('.').map(Number);
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    input = input.slice(0, lastColon + 1) + high + ':' + low;
  }

  const parts = input.split('::');
  if (parts.length > 2) return null;
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((parts.length === 1 && missing !== 0) || (parts.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8 || groups.some(group => !/^[0-9a-f]{1,4}$/.test(group))) return null;

  return groups.reduce((value, group) => (value << 16n) | BigInt(parseInt(group, 16)), 0n);
}

function ipv6InCidr(address: string, network: string, prefixLength: number): boolean {
  const addressValue = ipv6ToBigInt(address);
  const networkValue = ipv6ToBigInt(network);
  if (addressValue === null || networkValue === null) return false;
  const shift = BigInt(128 - prefixLength);
  return (addressValue >> shift) === (networkValue >> shift);
}

export interface SsrfValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  error?: string;
  isLocal: boolean;
}

/**
 * Checks if an IP address belongs to private, loopback, link-local, multicast, or reserved ranges.
 */
export function isRestrictedOrPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return false;

  // IPv4 Checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [p0, p1, p2, p3] = parts;

    // 0.0.0.0/8 (Current network)
    if (p0 === 0) return true;

    // 10.0.0.0/8 (Private-Use)
    if (p0 === 10) return true;

    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) return true;

    // 169.254.0.0/16 (Link-Local, AWS/GCP/Azure Metadata: 169.254.169.254)
    if (p0 === 169 && p1 === 254) return true;

    // 172.16.0.0/12 (Private-Use: 172.16.0.0 - 172.31.255.255)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

    // 192.168.0.0/16 (Private-Use)
    if (p0 === 192 && p1 === 168) return true;

    // 100.64.0.0/10 (Shared Address Space / carrier-grade NAT)
    if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments; includes special-purpose hosts)
    if (p0 === 192 && p1 === 0 && p2 === 0) return true;

    // 192.0.2.0/24 (TEST-NET-1)
    if (p0 === 192 && p1 === 0 && p2 === 2) return true;

    // 192.88.99.0/24 (deprecated 6to4 relay anycast)
    if (p0 === 192 && p1 === 88 && p2 === 99) return true;

    // 198.18.0.0/15 (Benchmarking)
    if (p0 === 198 && (p1 === 18 || p1 === 19)) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (p0 === 198 && p1 === 51 && p2 === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (p0 === 203 && p1 === 0 && p2 === 113) return true;

    // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
    if (p0 >= 224 && p0 <= 239) return true;

    // 240.0.0.0/4 (Reserved for future use: 240.0.0.0 - 255.255.255.254)
    if (p0 >= 240) return true;

    // 255.255.255.255 (Broadcast)
    if (p0 === 255 && p1 === 255 && p2 === 255 && p3 === 255) return true;

    return false;
  }

  // IPv6 Checks
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();

    // IPv4-mapped and IPv4-compatible IPv6 destinations are rejected outright.
    // They are not appropriate remote provider destination forms and can create
    // inconsistent policy decisions across URL, resolver, and socket layers.
    if (normalized.startsWith('::ffff:') || normalized.startsWith('::')) return true;

    // Only globally-unicast 2000::/3 addresses are eligible for remote provider
    // connections. This rejects reserved, discard-only, link-local, ULA, multicast,
    // and other non-global IPv6 space by default.
    if (!ipv6InCidr(normalized, '2000::', 3)) return true;

    // Explicit non-global/special-purpose blocks inside 2000::/3.
    const blockedPrefixes: Array<[string, number]> = [
      ['2001::', 32],       // Teredo
      ['2001:2::', 48],     // Benchmarking
      ['2001:10::', 28],    // Deprecated ORCHID
      ['2001:db8::', 32],   // Documentation
      ['2002::', 16],       // 6to4 transition
      ['3fff::', 20],       // Documentation
    ];
    if (blockedPrefixes.some(([network, prefix]) => ipv6InCidr(normalized, network, prefix))) {
      return true;
    }

    return false;
  }const CLOUD_METADATA_HOSTNAMES = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata',
  'instance-data',
  '169.254.169.250',
  '169.254.170.2',
  'fd00:ec2::254'
]);

/**
 * Validates any outbound provider endpoint to prevent Server-Side Request Forgery (SSRF).
 *
 * Rules:
 * 1. Protocol must be http: or https:
 * 2. No embedded userinfo (e.g. http://user:pass@host)
 * 3. Never allow cloud metadata destinations (169.254.169.254, metadata.google.internal, etc.)
 * 4. If allowLocalTrusted is false: block all loopback, private LAN, link-local, multicast, and 0.0.0.0
 * 5. If requiresHttps is true: reject http: endpoints to protect transmitted API keys
 */
export function validateEndpointUrl(
  rawUrl: string,
  options: {
    allowLocalTrusted?: boolean;
    requiresHttps?: boolean;
    allowedLocalPorts?: number[];
  } = {}
): SsrfValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return { isValid: false, error: 'Endpoint URL cannot be empty.', isLocal: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { isValid: false, error: 'Invalid URL structure.', isLocal: false };
  }

  // 1. Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      error: `Unsupported URL protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
      isLocal: false
    };
  }

  // 2. Prohibit embedded credentials in URL
  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      error: 'URLs containing embedded credentials (user:pass@) are prohibited.',
      isLocal: false
    };
  }

  // WHATWG URL.hostname retains square brackets around IPv6 literals.
  // Strip only a matching outer pair before IP classification and hostname checks.
  const rawHostname = parsed.hostname.toLowerCase().trim();
  const hostname = rawHostname.startsWith('[') && rawHostname.endsWith(']')
    ? rawHostname.slice(1, -1)
    : rawHostname;

  // Deceptive local hostname bypass check: e.g. localhost.evil.com, 127.0.0.1.evil.com, 10.0.0.1.attacker.net
  if (
    /(^|\.)(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)\.[a-z0-9\-]+/i.test(hostname)
  ) {
    return {
      isValid: false,
      error: `Deceptive hostname "${hostname}" is prohibited. Subdomains masquerading as local or private IP addresses are rejected.`,
      isLocal: false
    };
  }

  // 3. Cloud metadata check
  if (CLOUD_METADATA_HOSTNAMES.has(hostname) || hostname.endsWith('.metadata.google.internal')) {
    return {
      isValid: false,
      error: 'Access to cloud metadata and instance identity services is strictly prohibited.',
      isLocal: false
    };
  }

  // Determine if hostname is genuinely local
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const isDirectIp = net.isIP(hostname) !== 0;
  const isRestrictedIp = isDirectIp && isRestrictedOrPrivateIp(hostname);

  const isLocalOrPrivate = isLocalHost || isRestrictedIp;

  // 4. Local vs Remote access control
  if (options.allowLocalTrusted) {
    // Only allow explicit trusted local loopback: strictly localhost, 127.0.0.1, or ::1
    if (!isLocalHost) {
      return {
        isValid: false,
        error: `Only explicit trusted local loopback (localhost or 127.0.0.1) is permitted for local engine. Received "${hostname}".`,
        isLocal: false
      };
    }

    // Check port if specified
    const port = parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80);
    if (options.allowedLocalPorts && options.allowedLocalPorts.length > 0) {
      if (!options.allowedLocalPorts.includes(port)) {
        return {
          isValid: false,
          error: `Port ${port} is not permitted for local engine. Allowed ports: ${options.allowedLocalPorts.join(', ')}.`,
          isLocal: true
        };
      }
    }

    return {
      isValid: true,
      sanitizedUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ''),
      isLocal: true
    };
  }

  // Remote Provider: Must NOT target local or private IPs
  if (isLocalOrPrivate) {
    return {
      isValid: false,
      error: `Remote provider endpoint cannot target loopback, private LAN, or internal host "${hostname}".`,
      isLocal: true
    };
  }

  // 5. Remote API key transmission requires HTTPS
  if (options.requiresHttps && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      error: 'Remote providers that transmit API credentials require secure HTTPS connections.',
      isLocal: false
    };
  }

  return {
    isValid: true,
    sanitizedUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ''),
    isLocal: false
  };
}

/**
 * Redacts secret credentials and sensitive tokens from error messages and log outputs.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') return '';
  return message
    // URL userinfo can leak passwords when lower-level clients include the endpoint in errors.
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\/@\s]+@/gi, '$1[REDACTED]@')
    // Authorization headers and common provider token formats.
    .replace(/\b(Bearer|Basic)\s+[^\s,;"']+/gi, '$1 [REDACTED]')
    .replace(/AIzaSy[a-zA-Z0-9_\-]{20,}/g, 'AIzaSy[REDACTED]')
    .replace(/\bsk-(?:ant-)?[a-zA-Z0-9_\-]{12,}\b/gi, '[API KEY REDACTED]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/g, '[TOKEN REDACTED]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[ACCESS KEY REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[JWT REDACTED]')
    // Key/value and URL query parameters, including JSON-style quoted property names.
    .replace(/([?&](?:api[_-]?key|key|secret|token|access[_-]?token|password)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/(["']?\b(?:api[_-]?key|key|secret|token|access[_-]?token|password|authorization)\b["']?\s*[:=]\s*["']?)[^\s,;"'&}]{8,}/gi, '$1[REDACTED]')
    // Remove control characters and cap untrusted provider/error text before returning it to the UI.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .slice(0, 500);
}