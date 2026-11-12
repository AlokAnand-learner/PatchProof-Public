import fs from 'node:fs';
import path from 'node:path';
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
const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
assertServerLanguageIsServerDerived(serverSource);
function assertServerLanguageIsServerDerived(source: string): void {
  if (!source.includes('const safeLanguage = detectedLanguage;')) {
    throw new Error('Single-file analysis must derive its language from the validated filename/content.');
  }
  if (source.includes('allowedLanguages.has(language)')) {
    throw new Error('Single-file analysis must not trust the client-supplied language label.');
  }
}
console.log(`Single-file/path policy: ${valid.length + invalid.length + unsafePaths.length + 1} assertions passed.`);
