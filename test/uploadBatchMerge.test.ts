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
assert.equal(merged.stagedFiles[0].size, new Blob([first.content]).size, 'existing staged byte metadata must also be recomputed');
assert.equal(merged.stagedFiles[0].lines, first.content.split('\\n').length, 'existing staged line metadata must also be recomputed');

const unsafeExisting = mergeStagedFileBatches(
  [makeFile('../outside.ts', 'const unsafe = true;'), first],
  [second],
);
assert.equal(unsafeExisting.stagedFiles.length, 2, 'unsafe existing paths must be dropped while safe staged files remain');
assert.ok(unsafeExisting.skippedFiles.some(item => item.includes('Previously staged entry')));

const duplicateExisting = mergeStagedFileBatches(
  [first, makeFile('SRC/FIRST.TS', 'const duplicate = true;')],
  [second],
);
assert.equal(duplicateExisting.stagedFiles.length, 2, 'case-colliding existing entries must be normalized to one');
assert.ok(duplicateExisting.skippedFiles.some(item => item.includes('Duplicate, case-colliding, or file/directory-conflicting existing path')));

const directoryCaseCollision = mergeStagedFileBatches(
  [makeFile('Src/first.ts', 'const first = true;')],
  [makeFile('src/second.ts', 'const second = true;')],
);
assert.equal(directoryCaseCollision.stagedFiles.length, 1, 'case-colliding parent directories must be rejected');
assert.ok(directoryCaseCollision.skippedFiles.some(item => item.includes('file/directory-conflicting path rejected')));

const fileDirectoryConflict = mergeStagedFileBatches(
  [makeFile('src/config.ts', 'const config = true;')],
  [makeFile('src/config.ts/child.ts', 'const child = true;')],
);
assert.equal(fileDirectoryConflict.stagedFiles.length, 1, 'a staged file cannot also be a parent directory');
assert.ok(fileDirectoryConflict.skippedFiles.some(item => item.includes('file/directory-conflicting path rejected')));

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
assert.equal(lineCap.stagedFiles.length, 4, 'the invalid existing entry is dropped and the new safe file can be staged');
assert.equal(lineCap.stagedFiles.some(file => file.relativePath === 'src/part-4.ts'), false, 'existing staged entries beyond the project line cap must be dropped');
assert.equal(lineCap.stagedFiles.some(file => file.relativePath === 'src/extra.ts'), true);
assert.ok(lineCap.skippedFiles.some(item => item.includes('Existing staged content exceeds configured source line limits')));

console.log('Cumulative upload batch limits and staged-state validation: 9 scenarios passed.');
