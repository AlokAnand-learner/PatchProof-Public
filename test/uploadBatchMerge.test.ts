import assert from 'node:assert/strict';
import { DEFAULT_LIMITS, mergeStagedFileBatches } from '../src/utils/archiveUtils';
import type { StagedFile } from '../src/types/security';

const makeFile = (relativePath: string, content: string): StagedFile => ({
  id: relativePath,
  name: relativePath.split('/').pop() || 'source.ts',
  relativePath,
  size: 1, // Deliberately untrusted: merge recomputes actual UTF-8 bytes.
  language: 'typescript',
  content,
  lines: 1
});

const first = makeFile('src/first.ts', 'const first = 1;');
const second = makeFile('src/second.ts', 'const second = 2;');
const merged = mergeStagedFileBatches([first], [second]);
assert.equal(merged.stagedFiles.length, 2);
assert.equal(merged.stagedFiles[1].size, new Blob([second.content]).size);

const duplicate = mergeStagedFileBatches([first], [makeFile('SRC/FIRST.TS', 'const duplicate = true;')]);
assert.equal(duplicate.stagedFiles.length, 1);
assert.ok(duplicate.skippedFiles.some(item => item.includes('Duplicate or case-colliding')));

const fileCap = mergeStagedFileBatches([first], [second], { ...DEFAULT_LIMITS, maxFileCount: 1 });
assert.equal(fileCap.stagedFiles.length, 1);
assert.ok(fileCap.skippedFiles.some(item => item.includes('Combined project exceeds 1 files')));

const byteCap = mergeStagedFileBatches(
  [makeFile('src/a.ts', '123456')],
  [makeFile('src/b.ts', '12345')],
  { ...DEFAULT_LIMITS, maxTotalExtractedSize: 10 }
);
assert.equal(byteCap.stagedFiles.length, 1);
assert.ok(byteCap.skippedFiles.some(item => item.includes('Combined project exceeds total content size limit')));

const lineHeavy = (index: number) => makeFile(`src/part-${index}.ts`, 'x\n'.repeat(75000));
const lineCap = mergeStagedFileBatches(
  [lineHeavy(1), lineHeavy(2), lineHeavy(3), lineHeavy(4)],
  [makeFile('src/extra.ts', 'const extra = true;')]
);
assert.equal(lineCap.stagedFiles.length, 4);
assert.ok(lineCap.skippedFiles.some(item => item.includes('Combined project exceeds source line limit')));

console.log('Cumulative upload batch limits: 5 scenarios passed.');
