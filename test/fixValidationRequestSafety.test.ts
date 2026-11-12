import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
const routeStart = source.indexOf('const handleFixValidation');
const routeEnd = source.indexOf('// Fix Validation Suite Benchmark Endpoint', routeStart);
assert.ok(routeStart >= 0 && routeEnd > routeStart, 'fix validation handler must exist');
const handler = source.slice(routeStart, routeEnd);
assert.ok(handler.includes("typeof patch !== 'string'"), 'patch must be type-checked');
assert.ok(handler.includes("typeof value !== 'string'"), 'optional request fields must be type-checked');
assert.ok(handler.includes("['originalCode', originalCode]"), 'both original source aliases must be type-checked');
assert.ok(handler.includes("Buffer.byteLength(value, 'utf8') > 2 * 1024 * 1024"), 'individual source fields must have a byte limit');
assert.ok(handler.includes("> 6 * 1024 * 1024"), 'combined source fields must have an aggregate byte limit');
assert.ok(handler.includes('metadata exceeds the allowed length'), 'metadata lengths must be bounded');
assert.match(source, /app\.post\('\/api\/fix\/validate', requireSessionAuth, withProviderTask\(handleFixValidation\)\)/);
assert.match(source, /app\.post\('\/api\/validate-fix', requireSessionAuth, withProviderTask\(handleFixValidation\)\)/);
assert.match(source, /app\.get\('\/api\/fix\/benchmark', withProviderTask/);
console.log('Fix validation request safety: 8 assertions passed');
