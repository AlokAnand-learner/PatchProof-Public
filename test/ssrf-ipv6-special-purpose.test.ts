import assert from 'node:assert/strict';
import { validateEndpointUrl } from '../src/utils/ssrfValidator';

const blocked = [
  'https://[fec0::1]/api',
  'https://[2001:db8::1]/api',
  'https://[2001::1]/api',
  'https://[2002:7f00:1::1]/api',
  'https://[64:ff9b::c000:201]/api',
  'https://[64:ff9b:1::c000:201]/api',
  'https://[::ffff:169.254.169.254]/api',
  'https://[::ffff:10.0.0.1]/api',
  'https://[::ffff:127.0.0.1]/api',
  'https://[::ffff:8.8.8.8]/api',
  'https://[2001:0:1::1]/api',
  'https://[2001:1::1]/api',
  'https://[2001:5::1]/api',
  'https://[2001:2::1]/api',
  'https://[2001:10::1]/api',
  'https://[3fff::1]/api',
  'https://[100::1]/api',
  'https://[100:0:0:1::1]/api',
  'https://[4000::1]/api',
  'https://[5f00::1]/api',
  'https://[fed0::1]/api',
];

for (const endpoint of blocked) {
  const result = validateEndpointUrl(endpoint);
  assert.equal(result.isValid, false, `special-purpose IPv6 endpoint must be blocked: ${endpoint}`);
}

const publicEndpoints = [
  'https://[2606:4700:4700::1111]/api',
  'https://[2001:4860:4860::8888]/api',
  'https://[2001:200::1]/api',
];

for (const endpoint of publicEndpoints) {
  const result = validateEndpointUrl(endpoint);
  assert.equal(result.isValid, true, `globally routable IPv6 endpoint should remain eligible: ${endpoint}`);
}

console.log(`Special-purpose IPv6 SSRF regression checks: ${blocked.length + publicEndpoints.length} passed`);
