import assert from 'node:assert/strict';
import { createConcurrencyGate, runWithConcurrencyGate } from '../src/utils/concurrencyGate';

const gate = createConcurrencyGate(2);
const releaseOne = gate.tryAcquire();
const releaseTwo = gate.tryAcquire();
assert.equal(typeof releaseOne, 'function');
assert.equal(typeof releaseTwo, 'function');
assert.equal(gate.activeCount(), 2);
assert.equal(gate.tryAcquire(), null, 'third concurrent task must be rejected');
releaseOne?.();
releaseOne?.();
assert.equal(gate.activeCount(), 1, 'release must be idempotent');
const releaseThree = gate.tryAcquire();
assert.equal(typeof releaseThree, 'function');
releaseTwo?.();
releaseThree?.();
assert.equal(gate.activeCount(), 0);
assert.throws(() => createConcurrencyGate(0));

const asyncGate = createConcurrencyGate(1);
let finishTask: (() => void) | undefined;
const pendingTask = runWithConcurrencyGate(asyncGate, () => new Promise<void>(resolve => {
  finishTask = resolve;
}));
assert.equal(asyncGate.activeCount(), 1, 'async task must hold its slot while pending');
const rejectedWhileBusy = await runWithConcurrencyGate(asyncGate, () => 'must not run');
assert.deepEqual(rejectedWhileBusy, { acquired: false }, 'busy gate must reject additional work');
finishTask?.();
assert.deepEqual(await pendingTask, { acquired: true, value: undefined });
assert.equal(asyncGate.activeCount(), 0, 'async task releases its slot only after settling');
await assert.rejects(runWithConcurrencyGate(asyncGate, async () => {
  throw new Error('expected task failure');
}), /expected task failure/);
assert.equal(asyncGate.activeCount(), 0, 'rejected tasks must also release their slot');

console.log('Provider concurrency gate: 14 assertions passed.');
