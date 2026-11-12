import { validateEndpointUrl } from '../src/utils/ssrfValidator';

const blocked = [
  'http://100.64.0.1:8080',
  'http://100.127.255.254:8080',
  'http://192.0.0.1:8080',
  'http://192.88.99.1:8080',
  'http://198.18.0.1:8080',
  'http://198.19.255.254:8080',
];
for (const endpoint of blocked) {
  const result = validateEndpointUrl(endpoint);
  if (result.isValid) throw new Error(`Expected special-purpose address to be blocked: ${endpoint}`);
}

const publicEndpoints = [
  'https://100.63.255.255/api',
  'https://100.128.0.1/api',
  'https://198.17.255.255/api',
  'https://198.20.0.1/api',
];
for (const endpoint of publicEndpoints) {
  const result = validateEndpointUrl(endpoint);
  if (!result.isValid) throw new Error(`Expected adjacent public address to pass: ${endpoint}`);
}

console.log('Special-purpose IPv4 SSRF regression checks: 10 passed.');
