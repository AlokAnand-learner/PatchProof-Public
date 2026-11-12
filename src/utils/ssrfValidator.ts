/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import net from 'net';

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

    // ::1 (Loopback) or :: (Unspecified)
    if (normalized === '::1' || normalized === '::') return true;

    // IPv4-mapped IPv6 (::ffff:127.0.0.1 or Node's canonical ::ffff:7f00:1).
    // URL.hostname returns IPv6 literals in brackets, so callers normalize those
    // brackets before reaching this helper.
    if (normalized.startsWith('::ffff:')) {
      const mappedPart = normalized.substring(7);
      if (net.isIPv4(mappedPart)) {
        return isRestrictedOrPrivateIp(mappedPart);
      }

      // WHATWG URL parsing canonicalizes dotted IPv4-mapped literals to two
      // hexadecimal 16-bit groups (for example ::ffff:7f00:1).
      const mappedGroups = mappedPart.split(':');
      if (mappedGroups.length === 2 && mappedGroups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) {
        const high = Number.parseInt(mappedGroups[0], 16);
        const low = Number.parseInt(mappedGroups[1], 16);
        const mappedIpv4 = [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
        return isRestrictedOrPrivateIp(mappedIpv4);
      }
    }

    // fe80::/10 (Link-Local)
    if (/^fe[89ab]/i.test(normalized)) return true;

    // fc00::/7 (Unique Local Address - private)
    if (/^f[cd]/i.test(normalized)) return true;

    // fec0::/10 (deprecated site-local unicast).
    if (/^fec[0-9a-f]:/i.test(normalized)) return true;

    // 2001:db8::/32 (documentation-only prefix).
    if (normalized.startsWith('2001:db8:')) return true;

    // 2001::/32 (Teredo) and 2002::/16 (6to4) embed IPv4 routing information.
    if (normalized.startsWith('2001::') || normalized.startsWith('2002:')) return true;

    // NAT64 translation prefixes can encode IPv4 destinations; reject them at this boundary.
    if (normalized.startsWith('64:ff9b::') || normalized.startsWith('64:ff9b:1:')) return true;

    // ff00::/8 (Multicast)
    if (normalized.startsWith('ff')) return true;

    return false;
  }

  return false;
}

const CLOUD_METADATA_HOSTNAMES = new Set([
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