import { sanitizeRelativePath, sanitizeSingleFileName } from '../src/utils/archiveUtils';

const valid: Array<[unknown, string]> = [
  ['main.ts', 'main.ts'],
  ['src\\main.py', 'main.py'],
  ['../../src/app.js', 'app.js'],
  ['.env.example', '.env.example'],
];
for (const [input, expected] of valid) {
  const actual = sanitizeSingleFileName(input);
  if (actual !== expected) throw new Error(`Expected ${String(input)} -> ${expected}, got ${String(actual)}`);
}
const invalid: unknown[] = [null, 12, '', 'x'.repeat(501), 'file.exe', 'image.svg', '..', '.', 'file\u0000.js', 'notes.md'];
for (const input of invalid) {
  if (sanitizeSingleFileName(input) !== null) throw new Error(`Invalid filename accepted: ${String(input)}`);
}
const unsafePaths = [
  '../../etc/passwd', '/etc/shadow', 'C:\\Windows\\system.ini', 'src//app.ts',
  'src/./app.ts', 'src/../app.ts', 'src\u0000/app.ts', 'a'.repeat(501) + '.ts',
  'src/.. /evil.ts', 'src/evil.ts./file.ts', 'src/CON.ts', 'src/ folder/file.ts',
  ' src/file.ts', 'src/file.ts ', 'src/hello:world.ts'
];
for (const candidate of unsafePaths) {
  if (sanitizeRelativePath(candidate) !== null) throw new Error(`Unsafe relative path accepted: ${JSON.stringify(candidate)}`);
}
if (sanitizeRelativePath('src/components/App.tsx') !== 'src/components/App.tsx') {
  throw new Error('A normal relative source path was rejected.');
}
console.log(`Single-file/path policy: ${valid.length + invalid.length + unsafePaths.length + 1} assertions passed.`);
