import assert from 'node:assert/strict';
import { validateEndpointUrl } from '../src/utils/ssrfValidator';

const blocked = [
  'https://[fec0::1]/api',
  'https://[2001:db8::1]/api',
  'https://[2001::1]/api',
  'https://[2002:7f00:1::1]/api',
  'https://[64:ff9b::c000:201]/api',
  'https://[64:ff9b:1::c000:201]/api',
];

for (const endpoint of blocked) {
  const result = validateEndpointUrl(endpoint);
  assert.equal(result.isValid, false, `special-purpose IPv6 endpoint must be blocked: ${endpoint}`);
}

const publicEndpoints = [
  'https://[2606:4700:4700::1111]/api',
  'https://[2001:4860:4860::8888]/api',
];

for (const endpoint of publicEndpoints) {
  const result = validateEndpointUrl(endpoint);
  assert.equal(result.isValid, true, `globally routable IPv6 endpoint should remain eligible: ${endpoint}`);
}

console.log('Special-purpose IPv6 SSRF regression checks: 8 passed');
