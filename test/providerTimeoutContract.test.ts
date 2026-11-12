import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const server = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
const provider = fs.readFileSync(path.join(process.cwd(), 'src/engine/providerEngine.ts'), 'utf8');
const pinned = fs.readFileSync(path.join(process.cwd(), 'src/utils/pinnedHttps.ts'), 'utf8');

assert.equal((server.match(/generateAnalysisWithActiveProvider\(/g) || []).length, 3,
  'All three provider analysis routes must call the provider directly.');
assert.equal(/Promise\.race\([\s\S]{0,300}generateAnalysisWithActiveProvider\(/.test(server), false,
  'AI routes must not race a timer and detach provider work.');
assert.equal((server.match(/await generateAnalysisWithActiveProvider\(/g) || []).length, 3,
  'Every provider analysis route must await completion before releasing its request/concurrency scope.');

assert.ok(provider.includes('const controller = new AbortController();'),
  'Ordinary provider HTTP transport must use an abort controller.');
assert.ok(provider.includes('setTimeout(() => controller.abort(), timeoutMs)'),
  'Ordinary provider transport must enforce a hard request timeout.');
assert.ok(provider.includes('clearTimeout(timer)'),
  'Ordinary provider transport must clear its timeout after completion.');
assert.ok(pinned.includes('deadlineTimer = setTimeout(() => request.destroy('),
  'Pinned HTTPS transport must destroy requests that exceed the total deadline.');
assert.ok(pinned.includes('request.destroy(new Error'),
  'Pinned HTTPS transport must abort the underlying socket on deadline or response overflow.');

console.log('Provider timeout/cancellation contract: 7 assertions passed.');
