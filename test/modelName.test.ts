import { normalizeModelName } from '../src/utils/modelName.ts';

let passed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`${name}: expected ${String(expected)}, received ${String(actual)}`);
  passed++;
}
function rejects(name: string, action: () => unknown) {
  try { action(); } catch { passed++; return; }
  throw new Error(`${name}: expected validation failure`);
}

check('trims valid model identifiers', normalizeModelName('  qwen2.5-coder  '), 'qwen2.5-coder');
check('preserves empty as no override', normalizeModelName('   '), undefined);
check('preserves omitted as no override', normalizeModelName(undefined), undefined);
check('accepts exactly 128 characters', normalizeModelName('m'.repeat(128)), 'm'.repeat(128));
rejects('rejects identifiers longer than 128 characters', () => normalizeModelName('m'.repeat(129)));
rejects('rejects line breaks', () => normalizeModelName('model\nforged'));
rejects('rejects non-string values', () => normalizeModelName({ model: 'injected' }));
rejects('rejects explicit null values', () => normalizeModelName(null));
rejects('rejects null bytes', () => normalizeModelName('model\u0000name'));

console.log(`Model identifier validation: ${passed}/9 passed.`);
