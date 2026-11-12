import assert from 'node:assert/strict';
import { createPinnedLookup, validatePublicDnsAnswers } from '../src/utils/pinnedHttps';

validatePublicDnsAnswers('example.com', [
  { address: '8.8.8.8', family: 4 },
  { address: '2606:4700:4700::1111', family: 6 },
]);
assert.throws(() => validatePublicDnsAnswers('example.com', []), /did not resolve/);
assert.throws(() => validatePublicDnsAnswers('example.com', [{ address: '10.0.0.1', family: 4 }]), /restricted/);
assert.throws(() => validatePublicDnsAnswers('example.com', [{ address: '127.0.0.1', family: 4 }]), /restricted/);
assert.throws(() => validatePublicDnsAnswers('example.com', [{ address: '169.254.169.254', family: 4 }]), /restricted/);
assert.throws(() => validatePublicDnsAnswers('example.com', [{ address: '::ffff:10.0.0.1', family: 6 }]), /restricted/);
assert.throws(() => validatePublicDnsAnswers('example.com', [{ address: 'not-an-ip', family: 4 }]), /restricted/);
assert.throws(() => validatePublicDnsAnswers('example.com', [
  { address: '8.8.8.8', family: 4 },
  { address: '10.0.0.8', family: 4 },
]), /restricted/, 'one restricted answer must reject the entire DNS answer set');
assert.throws(() => validatePublicDnsAnswers('example.com', [
  { address: '2606:4700:4700::1111', family: 4 },
]), /restricted/, 'address family metadata must match the parsed address');
assert.throws(() => validatePublicDnsAnswers('example.com', [
  { address: '192.0.2.10', family: 4 },
]), /restricted/, 'documentation IPv4 space must not be accepted as a provider destination');


const answers = [
  { address: '8.8.8.8', family: 4 },
  { address: '2606:4700:4700::1111', family: 6 },
];
const lookup = createPinnedLookup('example.com', answers);
let allResult: any;
lookup('example.com', { all: true }, (error: Error | null, value: unknown) => {
  assert.equal(error, null);
  allResult = value;
});
assert.deepEqual(allResult, answers);

let singleResult: any;
lookup('example.com', {}, (error: Error | null, address: string, family: number) => {
  assert.equal(error, null);
  singleResult = { address, family };
});
assert.deepEqual(singleResult, answers[0]);

let mismatch: any;
lookup('attacker.example', {}, (error: any) => { mismatch = error; });
assert.equal(mismatch?.code, 'ENOTFOUND');

console.log('Pinned HTTPS DNS regression tests: 13 passed');
