/**
 * SSRF & Network Boundary Protection Unit Tests
 * Verifies that dangerous, private, loopback, link-local, cloud-metadata,
 * and userinfo URLs are strictly blocked, while secure public/whitelisted URLs pass.
 */
import { validateEndpointUrl, sanitizeErrorMessage } from '../src/utils/ssrfValidator';

console.log('===========================================================');
console.log('   PATCHPROOF SSRF & CREDENTIAL MASKING TEST SUITE         ');
console.log('===========================================================');

let passCount = 0;
let failCount = 0;

function assert(description: string, condition: boolean) {
  if (condition) {
    console.log(`[✓ PASS] ${description}`);
    passCount++;
  } else {
    console.error(`[✗ FAIL] ${description}`);
    failCount++;
  }
}

// 1. Cloud Metadata Attacks
const metadata1 = validateEndpointUrl('http://169.254.169.254/latest/meta-data/');
assert('Block AWS/GCP/Azure link-local metadata IP 169.254.169.254', !metadata1.isValid && !!metadata1.error);

const metadata2 = validateEndpointUrl('http://metadata.google.internal/computeMetadata/v1/');
assert('Block Google Cloud metadata hostname metadata.google.internal', !metadata2.isValid && !!metadata2.error);

// 2. Private LAN & Loopback IP Range Blocking (default remote provider context)
const private1 = validateEndpointUrl('http://10.0.0.1:8080/v1/chat/completions');
assert('Block 10.0.0.0/8 private IP', !private1.isValid);

const private2 = validateEndpointUrl('http://192.168.1.1/api');
assert('Block 192.168.0.0/16 private IP', !private2.isValid);

const private3 = validateEndpointUrl('http://172.16.0.5:8000');
assert('Block 172.16.0.0/12 private IP', !private3.isValid);

const loopbackRemote = validateEndpointUrl('http://127.0.0.1:11434', { allowLocalTrusted: false });
assert('Block 127.0.0.1 when allowLocalTrusted is false', !loopbackRemote.isValid);

// IPv6 URL.hostname values are bracketed by the WHATWG URL parser.
const ipv6LoopbackRemote = validateEndpointUrl('http://[::1]:11434', { allowLocalTrusted: false });
assert('Block bracketed IPv6 loopback for remote providers', !ipv6LoopbackRemote.isValid && ipv6LoopbackRemote.isLocal);

const ipv6LoopbackLocal = validateEndpointUrl('http://[::1]:11434', { allowLocalTrusted: true, allowedLocalPorts: [11434] });
assert('Allow bracketed IPv6 loopback for explicitly trusted local engine', ipv6LoopbackLocal.isValid && ipv6LoopbackLocal.isLocal);

const ipv6UniqueLocal = validateEndpointUrl('http://[fd00::1]/api');
assert('Block IPv6 unique-local addresses for remote providers', !ipv6UniqueLocal.isValid && ipv6UniqueLocal.isLocal);

const ipv6LinkLocal = validateEndpointUrl('http://[fe80::1]/api');
assert('Block IPv6 link-local addresses for remote providers', !ipv6LinkLocal.isValid && ipv6LinkLocal.isLocal);

const ipv4MappedLoopback = validateEndpointUrl('http://[::ffff:127.0.0.1]/api');
assert('Block IPv4-mapped IPv6 loopback for remote providers', !ipv4MappedLoopback.isValid && ipv4MappedLoopback.isLocal);

const ipv4MappedPrivate = validateEndpointUrl('http://[::ffff:192.168.1.10]/api');
assert('Block IPv4-mapped IPv6 private LAN addresses for remote providers', !ipv4MappedPrivate.isValid && ipv4MappedPrivate.isLocal);

// 3. Trusted Ollama Localhost
const loopbackOllama = validateEndpointUrl('http://127.0.0.1:11434', { allowLocalTrusted: true, allowedLocalPorts: [11434] });
assert('Allow 127.0.0.1 for trusted local Ollama instance on port 11434', loopbackOllama.isValid);

// 4. Scheme & Embedded Userinfo Attacks
const userinfoAttack = validateEndpointUrl('https://admin:password@api.anthropic.com/v1');
assert('Block embedded userinfo (credentials in URL authority)', !userinfoAttack.isValid && Boolean(userinfoAttack.error?.includes('embedded credentials')));

// Deceptive Offline-Bypass Hostnames (SEC-04)
const bypass1 = validateEndpointUrl('http://localhost.evil.com/api', { allowLocalTrusted: true });
assert('Reject deceptive localhost.evil.com', !bypass1.isValid);

const bypass2 = validateEndpointUrl('http://127.0.0.1.evil.com:11434', { allowLocalTrusted: true });
assert('Reject deceptive 127.0.0.1.evil.com', !bypass2.isValid);

const bypass3 = validateEndpointUrl('http://10.0.0.1.attacker.net/api', { allowLocalTrusted: true });
assert('Reject deceptive 10.0.0.1.attacker.net', !bypass3.isValid);

const bypass4 = validateEndpointUrl('http://192.168.1.1@evil.com/api', { allowLocalTrusted: true });
assert('Reject userinfo trick 192.168.1.1@evil.com', !bypass4.isValid);

const badScheme = validateEndpointUrl('ftp://example.com/api');
assert('Block non-HTTP/HTTPS protocols (e.g. ftp://)', !badScheme.isValid && Boolean(badScheme.error));

// 5. Valid Public HTTPS Provider Endpoint
const validPublic = validateEndpointUrl('https://api.openai.com/v1/chat/completions', { requiresHttps: true });
assert('Allow legitimate public HTTPS endpoint', validPublic.isValid && !validPublic.error);

// 6. Credential Masking in Error Messages
const rawError = 'Bearer sk-proj-1234567890abcdef1234567890abcdef and AIzaSyD9876543210zyxwvutsrqponmlkj failed with key=secret_val_12345678';
const sanitized = sanitizeErrorMessage(rawError);
assert('Redact bearer tokens in error messages', !sanitized.includes('sk-proj-') && sanitized.includes('Bearer [REDACTED]'));
assert('Redact Gemini AIzaSy API keys', !sanitized.includes('AIzaSyD9876543210') && sanitized.includes('AIzaSy[REDACTED]'));
assert('Redact generic key/value secrets', !sanitizeErrorMessage('apiKey=supersecretvalue123').includes('supersecretvalue123'));
assert('Redact URL query credentials', !sanitizeErrorMessage('request failed?access_token=synthetic_access_token_123').includes('synthetic_access_token_123'));
assert('Redact URL embedded userinfo', !sanitizeErrorMessage('request to https://alice:syntheticPassword123@example.test failed').includes('syntheticPassword123'));
assert('Redact JWT-shaped tokens', !sanitizeErrorMessage('token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.signatureValue123').includes('eyJhbGci'));
assert('Redact common GitHub tokens', !sanitizeErrorMessage('credential ghp_abcdefghijklmnopqrstuvwxyz123456').includes('ghp_'));
assert('Bound untrusted error message length', sanitizeErrorMessage('x'.repeat(900)).length === 500);
assert('Remove control characters from error messages', !sanitizeErrorMessage('safe\u0000unsafe').includes('\u0000'));

console.log('===========================================================');
console.log(`Results: ${passCount} passed, ${failCount} failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✓ ALL SSRF AND CREDENTIAL PROTECTION TESTS PASSED.');
  process.exit(0);
}
