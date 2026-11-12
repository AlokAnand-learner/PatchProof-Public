import assert from 'node:assert/strict';
import { resolveSameOriginRequestUrl } from '../src/utils/apiClient';

const origin = 'http://127.0.0.1:3000';
assert.equal(resolveSameOriginRequestUrl('/api/scan', origin), 'http://127.0.0.1:3000/api/scan');
assert.equal(resolveSameOriginRequestUrl('./api/history', origin), 'http://127.0.0.1:3000/api/history');
assert.equal(resolveSameOriginRequestUrl('http://127.0.0.1:3000/api/status', origin), 'http://127.0.0.1:3000/api/status');
for (const url of [
  'https://attacker.example/collect',
  '//attacker.example/collect',
  'http://127.0.0.1.evil.example/api',
  'javascript:alert(1)',
  'http://user:pass@127.0.0.1:3000/api',
  '',
]) {
  assert.throws(
    () => resolveSameOriginRequestUrl(url, origin),
    (error: unknown) => error instanceof Error,
    `must reject ${url}`,
  );
}
assert.throws(() => resolveSameOriginRequestUrl('/api/scan', 'file:///tmp/app'));
console.log('Same-origin authenticated request URL tests: 10 passed');
