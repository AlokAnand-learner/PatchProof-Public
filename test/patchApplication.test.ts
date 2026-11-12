import assert from 'node:assert/strict';
import { applyValidatedSnippetPatch } from '../src/utils/patchApplication';

const original = ['const before = true;', 'runUntrusted(input);', 'const after = true;'].join('\\n');
const finding = {
  startLine: 2,
  endLine: 2,
  snippet: 'runUntrusted(input);',
  suggestedPatch: 'runSafely(input);',
};

const valid = applyValidatedSnippetPatch(original, finding, 'VALIDATED');
assert.deepEqual(valid, {
  ok: true,
  code: ['const before = true;', 'runSafely(input);', 'const after = true;'].join('\\n'),
}, 'a validated patch must replace only the exact reviewed source snippet');

for (const status of ['NEEDS_REVIEW', 'PARTIALLY_VALIDATED', 'INVALID', 'UNKNOWN']) {
  const blocked = applyValidatedSnippetPatch(original, finding, status);
  assert.deepEqual(blocked, { ok: false, reason: 'validation-required' }, status + ' must not be applied');
}

assert.deepEqual(
  applyValidatedSnippetPatch(original, { ...finding, snippet: 'different source' }, 'VALIDATED'),
  { ok: false, reason: 'stale-source' },
  'changed source at the reviewed line range must fail closed',
);
assert.deepEqual(
  applyValidatedSnippetPatch(original, { ...finding, snippet: '' }, 'VALIDATED'),
  { ok: false, reason: 'stale-source' },
  'missing source evidence must fail closed',
);
assert.deepEqual(
  applyValidatedSnippetPatch(original, { ...finding, suggestedPatch: '  \\n ' }, 'VALIDATED'),
  { ok: false, reason: 'empty-patch' },
);
for (const [startLine, endLine] of [[0, 1], [-1, 1], [3, 2], [4, 4], [1.5, 2], [1, 1.5], [1, 202]]) {
  const blocked = applyValidatedSnippetPatch(original, { ...finding, startLine, endLine }, 'VALIDATED');
  assert.deepEqual(blocked, { ok: false, reason: 'invalid-range' }, 'invalid range must fail closed');
}

console.log('Validated snippet patch helper: 15 assertions passed');
