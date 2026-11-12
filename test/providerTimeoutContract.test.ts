import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const server = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
const provider = fs.readFileSync(path.join(process.cwd(), 'src/engine/providerEngine.ts'), 'utf8');
const pinned = fs.readFileSync(path.join(process.cwd(), 'src/utils/pinnedHttps.ts'), 'utf8');
const gate = fs.readFileSync(path.join(process.cwd(), 'src/utils/concurrencyGate.ts'), 'utf8');

assert.equal((server.match(/generateAnalysisWithActiveProvider\(/g) || []).length, 3,
  'All three provider analysis routes must call the provider directly.');
assert.equal(/Promise\.race\([\s\S]{0,300}generateAnalysisWithActiveProvider\(/.test(server), false,
  'AI routes must not race a timer and detach provider work.');
assert.equal((server.match(/await generateAnalysisWithActiveProvider\(/g) || []).length, 3,
  'Every provider analysis route must await completion before releasing its request/concurrency scope.');

assert.ok(server.includes('function withProviderTask(handler: RequestHandler): RequestHandler'),
  'expensive routes must hold their concurrency slot around the actual handler Promise.');
assert.ok(server.includes('runWithConcurrencyGate(providerTaskGate'),
  'expensive routes must use the promise-scoped concurrency gate helper.');
assert.ok(gate.includes('value: await task()') && gate.includes('finally {\\n    release();'),
  'concurrency slots must be released only after handler completion or rejection.');
assert.equal(server.includes("res.once('close', releaseOnce)"), false,
  'client disconnect must not release capacity while asynchronous work is still running.');
assert.equal(server.includes('limitProviderTasks'), false,
  'the old response-lifecycle-only concurrency middleware must be removed.');

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

console.log('Provider timeout and concurrency lifecycle contract: 12 assertions passed.');
