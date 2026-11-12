import assert from 'node:assert/strict';
import { getContentSecurityPolicy } from '../src/utils/securityHeaders';

const productionPolicy = getContentSecurityPolicy(false);
const developmentPolicy = getContentSecurityPolicy(true);

assert.match(productionPolicy, /script-src 'self';/);
assert.doesNotMatch(productionPolicy, /script-src[^;]*unsafe-eval/);
assert.doesNotMatch(productionPolicy, /script-src[^;]*unsafe-inline/);
assert.match(developmentPolicy, /script-src 'self' 'unsafe-inline' 'unsafe-eval';/);
assert.match(productionPolicy, /object-src 'none';/);
assert.match(productionPolicy, /frame-ancestors 'self';/);
assert.match(productionPolicy, /base-uri 'self';/);

console.log('Content Security Policy: 7 assertions passed.');
