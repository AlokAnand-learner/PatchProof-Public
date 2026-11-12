/**
 * Upload Safety, Archive Hardening & TXT Support Unit Tests
 * Verifies Zip Slip rejection, absolute path rejection, symlink exclusion,
 * 2MB single-file limit, 20MB total extraction limit, and plain-text .txt handling.
 */
import JSZip from 'jszip';
import { safeExtractZip, sanitizeRelativePath, validateUploadedFile, isAllowedSourceFile, processFiles } from '../src/utils/archiveUtils';

console.log('===========================================================');
console.log('   PATCHPROOF UPLOAD & ARCHIVE SECURITY TEST SUITE         ');
console.log('===========================================================');

let passCount = 0;
let failCount = 0;

function assert(description: string, condition: boolean) {
  if (condition) {
    console.log(`[✓ PASS] ${description}`);
    passCount++;
  } else {
    console.error(`[✗ FAIL] ${description}`);
    failCount++;
  }
}

async function runUploadSafetyTests() {
  // 1. Path Sanitization: Path Traversal (Zip Slip)
  const slip1 = sanitizeRelativePath('../../etc/passwd');
  assert('Reject Zip Slip relative traversal (../../etc/passwd)', slip1 === null);

  const slip2 = sanitizeRelativePath('src/../../../root/.ssh/id_rsa');
  assert('Reject embedded path traversal', slip2 === null);

  // 2. Path Sanitization: Absolute Paths
  const absUnix = sanitizeRelativePath('/etc/shadow');
  assert('Reject leading slash absolute paths (/etc/shadow)', absUnix === null);

  const absWin = sanitizeRelativePath('C:\\Windows\\System32\\cmd.exe');
  assert('Reject Windows drive letters and backslashes', absWin === null);

  const uncPath = sanitizeRelativePath('\\\\192.168.1.1\\share\\data.txt');
  assert('Reject Windows UNC paths', uncPath === null);

  const safePath = sanitizeRelativePath('src/components/App.tsx');
  assert('Permit legitimate relative source paths', safePath === 'src/components/App.tsx');
  assert('Reject ambiguous repeated separators', sanitizeRelativePath('src//components/App.tsx') === null);
  assert('Reject control characters in paths', sanitizeRelativePath('src/evil\u0000.ts') === null);
  assert('Reject overlong relative paths', sanitizeRelativePath('a'.repeat(501) + '.ts') === null);

  // 3. Plain-text .txt support
  assert('Allow plain-text .txt source files in isAllowedSourceFile', isAllowedSourceFile('notes.txt'));
  assert('Allow source code snippets in snippets.txt', isAllowedSourceFile('vulnerable_snippet.txt'));

  const fileValidation = validateUploadedFile('analysis_sample.txt', 1024);
  assert('Validate .txt upload with valid size', fileValidation.valid);

  const oversizedFile = validateUploadedFile('large_dump.txt', 3 * 1024 * 1024);
  assert('Reject single file exceeding 2MB limit', !oversizedFile.valid && Boolean(oversizedFile.error?.includes('2MB')));

  // 4. Archive Extraction Hardening: Path Violation & Absolute Path Quarantine
  const maliciousZip = new JSZip();
  maliciousZip.file('/etc/shadow', 'root:x:0:0:evil');
  maliciousZip.file('src/normal.js', 'console.log("hello");');
  const malZipBuffer = await maliciousZip.generateAsync({ type: 'arraybuffer' });

  const extractResult = await safeExtractZip(malZipBuffer);
  assert('Absolute path entry is quarantined/skipped during safeExtractZip', !extractResult.stagedFiles.some(f => f.relativePath.startsWith('/')));
  assert('Legitimate file in zip is successfully extracted', extractResult.stagedFiles.some(f => f.relativePath === 'src/normal.js'));
  assert('Skipped entries recorded for quarantined path traversal/absolute path entry', extractResult.skippedFiles.length > 0 && extractResult.skippedFiles.some(s => s.includes('path traversal or ambiguous path')));

  const collidingZip = new JSZip();
  collidingZip.file('project/src/App.ts', 'const app = 1;');
  collidingZip.file('project/src/app.ts', 'const other = 2;');
  const collidingBuffer = await collidingZip.generateAsync({ type: 'arraybuffer' });
  const collidingResult = await safeExtractZip(collidingBuffer, { excludeDirs: false });
  assert('Reject case-colliding ZIP paths instead of staging both files', collidingResult.stagedFiles.length === 1 && collidingResult.skippedFiles.some(s => s.includes('case-colliding archive path')));

  assert('Reject Windows trailing-dot path segments', sanitizeRelativePath('src/evil.ts./file.ts') === null);
  assert('Reject Windows reserved device names', sanitizeRelativePath('src/CON.ts') === null);
  assert('Reject path components padded with whitespace', sanitizeRelativePath('src/ folder/file.ts') === null);

  // 5. Total Extracted Size Limit (20MB)
  const bombZip = new JSZip();
  // Create 21MB worth of data (above the 20MB limit)
  const hugeChunk = 'A'.repeat(1024 * 1024); // 1MB
  for (let i = 0; i < 22; i++) {
    bombZip.file(`chunk_${i}.txt`, hugeChunk);
  }
  const bombBuffer = await bombZip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });

  let bombCaught = false;
  try {
    await safeExtractZip(bombBuffer);
  } catch (err: any) {
    bombCaught = err.message.includes('exceeded') || err.message.includes('20MB');
  }
  assert('Decompression bomb / archive exceeding 20MB limit is aborted safely', bombCaught);

  // 6. Bound metadata iteration even when entries are unsupported and would be skipped.
  const manyEntriesZip = new JSZip();
  for (let i = 0; i < 5001; i++) manyEntriesZip.file(`ignored_${i}.md`, 'x');
  const manyEntriesBuffer = await manyEntriesZip.generateAsync({ type: 'arraybuffer' });
  let entryLimitCaught = false;
  try {
    await safeExtractZip(manyEntriesBuffer);
  } catch (err: any) {
    entryLimitCaught = err.message.includes('too many entries');
  }
  assert('Reject ZIP archives with more than 5,000 entries, including unsupported files', entryLimitCaught);

  // 7. Folder upload path handling: unsafe browser-supplied paths must not
  // fall back to file.name, and duplicate/case-colliding paths are rejected.
  const originalFileReader = (globalThis as any).FileReader;
  class TestFileReader {
    result: string | ArrayBuffer | null = null;
    onload: ((event: any) => void) | null = null;
    onerror: (() => void) | null = null;
    readAsText(file: any) {
      Promise.resolve(file.text()).then((value) => {
        this.result = value;
        this.onload?.({ target: this });
      }).catch(() => this.onerror?.());
    }
  }
  (globalThis as any).FileReader = TestFileReader;
  const makeMockFile = (name: string, relativePath: string, content: string) => ({
    name,
    size: new TextEncoder().encode(content).length,
    webkitRelativePath: relativePath,
    text: async () => content
  }) as unknown as File;

  try {
    const mixedUpload = await processFiles([
      makeMockFile('secret.ts', '../../outside/secret.ts', 'const secret = 1;'),
      makeMockFile('safe.ts', 'project/src/safe.ts', 'const safe = 1;')
    ], { excludeDirs: false });
    assert('Reject unsafe folder-upload relative path instead of falling back to basename', mixedUpload.stagedFiles.length === 1 && mixedUpload.stagedFiles[0].relativePath === 'project/src/safe.ts');
    assert('Record unsafe folder-upload path rejection', mixedUpload.skippedFiles.some(item => item.includes('unsafe or invalid relative path')));

    const duplicateUpload = await processFiles([
      makeMockFile('App.ts', 'project/src/App.ts', 'const app = 1;'),
      makeMockFile('app.ts', 'project/src/app.ts', 'const other = 2;')
    ], { excludeDirs: false });
    assert('Reject case-colliding duplicate folder-upload paths', duplicateUpload.stagedFiles.length === 1 && duplicateUpload.skippedFiles.some(item => item.includes('Duplicate or case-colliding')));
  } finally {
    if (originalFileReader === undefined) delete (globalThis as any).FileReader;
    else (globalThis as any).FileReader = originalFileReader;
  }

  console.log('===========================================================');
  console.log(`Results: ${passCount} passed, ${failCount} failed.`);

  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log('✓ ALL UPLOAD SAFETY & ARCHIVE HARDENING TESTS PASSED.');
    process.exit(0);
  }
}

runUploadSafetyTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
