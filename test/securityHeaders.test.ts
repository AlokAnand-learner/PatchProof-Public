import assert from 'node:assert/strict';
import { getContentSecurityPolicy } from '../src/utils/securityHeaders';

const productionPolicy = getContentSecurityPolicy(false);
const developmentPolicy = getContentSecurityPolicy(true);

assert.match(productionPolicy, /script-src 'self';/);
assert.doesNotMatch(productionPolicy, /script-src[^;]*unsafe-eval/);
assert.doesNotMatch(productionPolicy, /script-src[^;]*unsafe-inline/);
assert.match(developmentPolicy, /script-src 'self' 'unsafe-inline' 'unsafe-eval';/);
assert.match(productionPolicy, /object-src 'none';/);
assert.match(productionPolicy, /frame-ancestors 'none';/);
assert.match(productionPolicy, /base-uri 'self';/);
assert.match(productionPolicy, /connect-src 'self';/);
assert.doesNotMatch(productionPolicy, /ws:\/\//, 'production CSP must not permit browser connections to arbitrary loopback ports');
assert.match(developmentPolicy, /connect-src 'self' ws:\/\/localhost:\* ws:\/\/127\.0\.0\.1:\* ws:\/\/\[::1\]:\*;/);
assert.match(productionPolicy, /form-action 'self';/);
assert.match(productionPolicy, /frame-ancestors 'none';/);


console.log('Content Security Policy: 12 assertions passed.');
