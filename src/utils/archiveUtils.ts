import JSZip from 'jszip';
import { StagedFile, UploadLimits } from '../types/security';
import { countSourceLinesWithinLimit, MAX_SOURCE_LINES_PER_FILE, MAX_SOURCE_LINES_PER_PROJECT } from './sourceLimits';

export const DEFAULT_LIMITS: UploadLimits = {
  maxSingleFileSize: 2 * 1024 * 1024,      // 2MB per file
  maxArchiveSize: 25 * 1024 * 1024,        // 25MB archive limit
  maxTotalExtractedSize: 20 * 1024 * 1024, // 20MB cumulative extracted limit
  maxFileCount: 60,                        // Up to 60 source files per project review
  maxArchiveEntries: 5000                  // Bound ZIP metadata/entry iteration, including skipped files
};

/**
 * Merge another selection into an existing staged project while enforcing the
 * same cumulative limits as a single folder/ZIP ingestion. Sizes and line counts
 * are recomputed from content, never trusted from the staged metadata.
 */
export function mergeStagedFileBatches(
  existing: StagedFile[],
  incoming: StagedFile[],
  limits: UploadLimits = DEFAULT_LIMITS
): { stagedFiles: StagedFile[]; skippedFiles: string[] } {
  const stagedFiles = [...existing];
  const skippedFiles: string[] = [];
  const seenPaths = new Set(stagedFiles
    .filter(file => typeof file.relativePath === 'string')
    .map(file => file.relativePath.normalize('NFC').toLowerCase()));
  let totalBytes = stagedFiles.reduce((total, file) =>
    total + (typeof file.content === 'string' ? new Blob([file.content]).size : 0), 0);
  let totalLines = 0;
  for (const existingFile of stagedFiles) {
    const existingLineCount = typeof existingFile.content === 'string'
      ? countSourceLinesWithinLimit(existingFile.content, MAX_SOURCE_LINES_PER_FILE)
      : null;
    if (existingLineCount === null) {
      totalLines = MAX_SOURCE_LINES_PER_PROJECT;
      break;
    }
    totalLines += existingLineCount;
  }

  for (const file of incoming) {
    const safePath = sanitizeRelativePath(file?.relativePath);
    if (!safePath || !isSupportedSourceFile(safePath) || typeof file.content !== 'string' || file.content.length === 0) {
      skippedFiles.push('Selected entry (Invalid path or source content rejected)');
      continue;
    }
    const pathKey = safePath.normalize('NFC').toLowerCase();
    if (seenPaths.has(pathKey)) {
      skippedFiles.push(`${safePath} (Duplicate or case-colliding path rejected)`);
      continue;
    }
    if (stagedFiles.length >= limits.maxFileCount) {
      skippedFiles.push(`${safePath} (Combined project exceeds ${limits.maxFileCount} files)`);
      continue;
    }
    const actualBytes = new Blob([file.content]).size;
    if (actualBytes > limits.maxSingleFileSize) {
      skippedFiles.push(`${safePath} (Exceeds ${Math.floor(limits.maxSingleFileSize / 1024 / 1024)}MB single file limit)`);
      continue;
    }
    if (actualBytes > limits.maxTotalExtractedSize - totalBytes) {
      skippedFiles.push(`${safePath} (Combined project exceeds total content size limit)`);
      continue;
    }
    const lineCount = countSourceLinesWithinLimit(file.content, MAX_SOURCE_LINES_PER_FILE);
    if (lineCount === null) {
      skippedFiles.push(`${safePath} (Exceeds per-file source line limit of ${MAX_SOURCE_LINES_PER_FILE})`);
      continue;
    }
    if (totalLines + lineCount > MAX_SOURCE_LINES_PER_PROJECT) {
      skippedFiles.push(`${safePath} (Combined project exceeds source line limit of ${MAX_SOURCE_LINES_PER_PROJECT})`);
      continue;
    }

    seenPaths.add(pathKey);
    totalBytes += actualBytes;
    totalLines += lineCount;
    stagedFiles.push({ ...file, relativePath: safePath, size: actualBytes, lines: lineCount });
  }

  return { stagedFiles, skippedFiles };
}

export const DEFAULT_EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  'vendor',
  '__pycache__',
  '.vscode',
  '.idea',
  'coverage',
  '.turbo',
  'venv',
  '.venv',
  '.env',
  '.cache'
];

const SUPPORTED_EXTENSIONS = new Set([
  'js', 'jsx', 'mjs', 'cjs',
  'ts', 'tsx',
  'py', 'pyw',
  'go',
  'java',
  'php',
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
  'rs',
  'cs',
  'rb',
  'sql',
  'sh', 'bash', 'zsh',
  'json', 'yaml', 'yml',
  'html', 'htm',
  'css', 'scss',
  'xml', 'toml', 'ini', 'env.example',
  'txt', 'text'
]);

const PROHIBITED_EXTENSIONS = new Set([
  'exe', 'dll', 'bin', 'so', 'dylib', 'class', 'pyc', 'wasm',
  'zip', 'tar', 'gz', '7z', 'rar', 'bz2',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'mp4', 'mp3', 'wav',
  'pdf', 'docx', 'xlsx', 'pptx', 'sqlite', 'db'
]);

/**
 * Heuristically inspects plain-text source content to identify language
 * when file extension is .txt, generic text, or unmapped.
 */
export function detectLanguageFromContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return 'plaintext';

  // Shebang or python syntax
  if (
    /^#!\s*\/.*\bpython\b/m.test(trimmed) ||
    /(^|\n)\s*(def\s+\w+\s*\(|import\s+[\w\.]+|from\s+[\w\.]+\s+import|elif\s+|if\s+__name__\s*==\s*['"]__main__['"]:)/.test(trimmed)
  ) {
    return 'python';
  }

  // Shell script
  if (
    /^#!\s*\/.*\b(bash|sh|zsh)\b/m.test(trimmed) ||
    /(^|\n)\s*(echo\s+|chmod\s+|export\s+[A-Z_]+=)/.test(trimmed)
  ) {
    return 'shell';
  }

  // JavaScript / TypeScript
  if (
    /(^|\n)\s*(import\s+.*from\s+['"]|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|function\s+\w+\s*\(|module\.exports\s*=|require\s*\(['"])/.test(trimmed)
  ) {
    return /(:\s*(string|number|boolean|any)\b|interface\s+\w+|type\s+\w+\s*=)/.test(trimmed) ? 'typescript' : 'javascript';
  }

  // Java
  if (/(^|\n)\s*(public\s+class\s+\w+|public\s+static\s+void\s+main|System\.out\.print)/.test(trimmed)) {
    return 'java';
  }

  // Go
  if (/(^|\n)\s*package\s+\w+\b/.test(trimmed) || /(^|\n)\s*func\s+\w+\s*\(/.test(trimmed)) {
    return 'go';
  }

  // PHP
  if (/<\?php/.test(trimmed)) {
    return 'php';
  }

  // SQL
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i.test(trimmed)) {
    return 'sql';
  }

  // JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {}
  }

  return 'plaintext';
}

export function detectLanguage(filename: string, content?: string): string {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : '';

  if (ext === 'txt' || ext === 'text') {
    // Check if filename has double extension like app.js.txt or script.py.txt
    if (parts.length > 1) {
      const secondExt = parts[parts.length - 1].toLowerCase();
      const detectedFromSecond = detectLanguage(`file.${secondExt}`);
      if (detectedFromSecond !== 'plaintext') {
        return detectedFromSecond;
      }
    }
    if (content) {
      return detectLanguageFromContent(content);
    }
    return 'plaintext';
  }

  switch (ext) {
    case 'py':
    case 'pyw': return 'python';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs': return 'javascript';
    case 'ts':
    case 'tsx': return 'typescript';
    case 'go': return 'go';
    case 'java': return 'java';
    case 'php': return 'php';
    case 'c':
    case 'h':
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'hpp': return 'cpp';
    case 'rs': return 'rust';
    case 'cs': return 'csharp';
    case 'rb': return 'ruby';
    case 'sql': return 'sql';
    case 'sh':
    case 'bash':
    case 'zsh': return 'shell';
    case 'json': return 'json';
    case 'yaml':
    case 'yml': return 'yaml';
    case 'html':
    case 'htm': return 'html';
    case 'css': return 'css';
    default: return content ? detectLanguageFromContent(content) : 'plaintext';
  }
}

export function isSupportedSourceFile(filename: string): boolean {
  const normalized = filename.replace(/\\/g, '/');
  const baseName = normalized.split('/').pop() || '';
  if (!baseName || baseName.startsWith('.')) {
    // Allow the explicitly supported example environment template.
    if (baseName !== '.env.example') return false;
  }
  if (baseName === '.env.example') return true;

  const parts = baseName.split('.');
  if (parts.length < 2) return false;
  const ext = parts.pop()!.toLowerCase();

  if (PROHIBITED_EXTENSIONS.has(ext)) return false;
  return SUPPORTED_EXTENSIONS.has(ext);
}

export const isAllowedSourceFile = isSupportedSourceFile;

/**
 * Convert a user-supplied single-file label to a safe display/analysis filename.
 * Single-file reviews never need directory paths; only the final path segment is kept.
 */
export function sanitizeSingleFileName(rawName: unknown): string | null {
  if (typeof rawName !== 'string' || rawName.length === 0 || rawName.length > 500) return null;
  if (/[\x00-\x1F\x7F]/.test(rawName)) return null;

  const normalized = rawName.replace(/\\/g, '/');
  const leaf = normalized.split('/').pop() || '';
  const safeName = leaf.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 160);
  if (!safeName || safeName === '.' || safeName === '..' || !isSupportedSourceFile(safeName)) return null;
  return safeName;
}

export function validateUploadedFile(
  filename: string,
  size: number,
  limits: UploadLimits = DEFAULT_LIMITS
): { valid: boolean; error?: string } {
  if (size === 0) {
    return { valid: false, error: 'File is empty (0 bytes).' };
  }
  if (size > limits.maxSingleFileSize) {
    return {
      valid: false,
      error: `File exceeds 2MB limit: ${(size / (1024 * 1024)).toFixed(1)}MB.`
    };
  }
  if (!isSupportedSourceFile(filename)) {
    return {
      valid: false,
      error: `Unsupported file type. Supported formats include .js, .ts, .py, .go, .java, .txt, etc.`
    };
  }
  return { valid: true };
}

export function isBinaryContent(content: string): boolean {
  // Check for null bytes or excessive unprintable control characters in initial slice
  return /[\x00-\x08\x0E-\x1F]/.test(content.slice(0, 1024));
}

export function isPathExcluded(relativePath: string, excludedDirs: string[]): boolean {
  const segments = relativePath.replace(/\\/g, '/').split('/');
  return segments.some(segment => excludedDirs.includes(segment));
}

// Sanitizes and validates a path to prevent Zip Slip / Directory Traversal attacks
export function sanitizeRelativePath(rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== 'string' || rawPath.length > 500) return null;
  if (/[\x00-\x1F\x7F]/.test(rawPath)) return null;

  // Reject Windows drive letters (C:, D:) or UNC network shares (\\server\share)
  if (/^[a-zA-Z]:/i.test(rawPath) || rawPath.startsWith('\\\\')) {
    return null;
  }

  // Normalize separators but reject surrounding whitespace instead of silently
  // changing a caller-supplied path into a different logical filename.
  let clean = rawPath.replace(/\\/g, '/');
  if (clean !== clean.trim()) return null;

  // Explicitly reject absolute paths
  if (clean.startsWith('/')) {
    return null;
  }

  // Reject paths attempting directory traversal (Zip Slip)
  // Check for .. as a component or isolated element
  const segments = clean.split('/');
  // Empty segments, dot segments, trailing dots/spaces, and Windows device names
  // create ambiguous aliases across operating systems; reject them consistently.
  const invalidSegment = segments.some(seg =>
    seg.length === 0 || seg.trim() === '..' || seg.trim() === '.' ||
    seg !== seg.trim() || /[. ]$/.test(seg) || /[<>:"|?*]/.test(seg) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(seg)
  );
  if (invalidSegment) return null;

  // Reject embedded colon or null characters
  if (clean.includes(':') || clean.includes('\0')) {
    return null;
  }

  return clean;
}

/**
 * Inflates one ZIP entry incrementally and stops as soon as its actual output
 * exceeds the caller's byte budget. ZIP metadata is attacker-controlled, so
 * declared uncompressed sizes are only an early-rejection hint.
 */
async function extractEntryWithinLimit(entry: any, maxBytes: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const stream = entry.internalStream('uint8array');
    const chunks: Uint8Array[] = [];
    let total = 0;
    let settled = false;

    stream.on('data', (chunk: Uint8Array) => {
      if (settled) return;
      total += chunk.byteLength;
      if (total > maxBytes) {
        settled = true;
        stream.pause();
        reject(new Error('ZIP entry exceeds its actual decompressed size limit.'));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('error', (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    stream.on('end', () => {
      if (settled) return;
      settled = true;
      const output = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(output);
    });
    stream.resume();
  });
}

export interface ExtractionResult {
  stagedFiles: StagedFile[];
  skippedFiles: string[];
  totalExtractedSize: number;
  projectName: string;
}

/**
 * Reads ZIP end-of-central-directory metadata before JSZip parses the archive.
 * This rejects oversized entry tables before the ZIP parser allocates per-entry
 * objects. ZIP64 archives are supported for counting; multi-disk archives are
 * rejected because they are not valid single-upload inputs for this application.
 */
async function countZipEntriesBeforeParsing(
  input: File | Blob | ArrayBuffer | Uint8Array,
  maxEntries: number,
): Promise<number> {
  let bytes: Uint8Array;
  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = new Uint8Array(await input.arrayBuffer());
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimumEocdLength = 22;
  const maxCommentLength = 0xffff;
  const searchStart = Math.max(0, bytes.length - minimumEocdLength - maxCommentLength);
  let eocdOffset = -1;

  for (let offset = bytes.length - minimumEocdLength; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + minimumEocdLength + commentLength === bytes.length) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error('Invalid or corrupted ZIP archive. Please ensure the file is a valid .zip file.');

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries16 = view.getUint16(eocdOffset + 10, true);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0) {
    throw new Error('Multi-disk ZIP archives are not supported.');
  }

  let totalEntries: number;
  let centralDirectoryOffset: number;
  let centralDirectorySize: number;
  let directoryBoundary = eocdOffset;
  if (totalEntries16 !== 0xffff) {
    if (entriesOnDisk !== totalEntries16) {
      throw new Error('Invalid or corrupted ZIP archive entry metadata.');
    }
    totalEntries = totalEntries16;
    centralDirectorySize = view.getUint32(eocdOffset + 12, true);
    centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  } else {
    // ZIP64 locator immediately precedes the classic EOCD record.
    const locatorOffset = eocdOffset - 20;
    if (locatorOffset < 0 || view.getUint32(locatorOffset, true) !== 0x07064b50) {
      throw new Error('Invalid ZIP64 archive metadata.');
    }
    const zip64Disk = view.getUint32(locatorOffset + 4, true);
    const zip64OffsetBig = view.getBigUint64(locatorOffset + 8, true);
    const totalDisks = view.getUint32(locatorOffset + 16, true);
    if (zip64Disk !== 0 || totalDisks !== 1 || zip64OffsetBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Multi-disk or unsupported ZIP64 archives are not accepted.');
    }
    const zip64Offset = Number(zip64OffsetBig);
    if (zip64Offset + 56 > bytes.length || view.getUint32(zip64Offset, true) !== 0x06064b50) {
      throw new Error('Invalid ZIP64 end-of-central-directory record.');
    }
    const zip64RecordSize = view.getBigUint64(zip64Offset + 4, true);
    if (zip64RecordSize < 44n || BigInt(zip64Offset) + 12n + zip64RecordSize > BigInt(locatorOffset)) {
      throw new Error('Invalid ZIP64 end-of-central-directory record size.');
    }
    const zip64DiskNumber = view.getUint32(zip64Offset + 16, true);
    const zip64CentralDisk = view.getUint32(zip64Offset + 20, true);
    const zip64EntriesOnDisk = view.getBigUint64(zip64Offset + 24, true);
    const zip64TotalEntries = view.getBigUint64(zip64Offset + 32, true);
    if (zip64DiskNumber !== 0 || zip64CentralDisk !== 0 || zip64EntriesOnDisk !== zip64TotalEntries ||
        zip64TotalEntries > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Invalid or multi-disk ZIP64 entry metadata.');
    }
    totalEntries = Number(zip64TotalEntries);
    const centralDirectorySizeBig = view.getBigUint64(zip64Offset + 40, true);
    const centralDirectoryOffsetBig = view.getBigUint64(zip64Offset + 48, true);
    if (centralDirectorySizeBig > BigInt(Number.MAX_SAFE_INTEGER) || centralDirectoryOffsetBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Unsupported ZIP64 central-directory dimensions.');
    }
    centralDirectorySize = Number(centralDirectorySizeBig);
    centralDirectoryOffset = Number(centralDirectoryOffsetBig);
    directoryBoundary = zip64Offset;
  }


  // Do not trust the EOCD entry count by itself: a fake EOCD signature can be
  // embedded in the ZIP comment. Walk the bounded central directory and verify
  // that its actual record count and lengths agree before JSZip allocates entries.
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (!Number.isSafeInteger(centralDirectoryOffset) || !Number.isSafeInteger(centralDirectorySize) ||
      centralDirectoryOffset < 0 || centralDirectorySize < 0 ||
      centralDirectoryEnd > directoryBoundary || centralDirectoryEnd > bytes.length) {
    throw new Error('Invalid ZIP central-directory bounds.');
  }

  let cursor = centralDirectoryOffset;
  let actualEntries = 0;
  while (actualEntries < totalEntries) {
    if (cursor + 46 > centralDirectoryEnd || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('Invalid ZIP central-directory entry signature.');
    }
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const entryCommentLength = view.getUint16(cursor + 32, true);
    const diskStart = view.getUint16(cursor + 34, true);
    const recordLength = 46 + nameLength + extraLength + entryCommentLength;
    if (diskStart !== 0 || cursor + recordLength > centralDirectoryEnd) {
      throw new Error('Invalid or multi-disk ZIP central-directory entry.');
    }
    cursor += recordLength;
    actualEntries += 1;
  }

  if (actualEntries !== totalEntries) {
    throw new Error('ZIP central-directory entry count does not match end-of-directory metadata.');
  }
  if (cursor < centralDirectoryEnd) {
    // The optional central-directory digital-signature record may follow entries.
    if (cursor + 6 > centralDirectoryEnd || view.getUint32(cursor, true) !== 0x05054b50) {
      throw new Error('Unexpected data follows ZIP central-directory entries.');
    }
    const signatureLength = view.getUint16(cursor + 4, true);
    if (cursor + 6 + signatureLength !== centralDirectoryEnd) {
      throw new Error('Invalid ZIP central-directory digital signature length.');
    }
  }

  if (totalEntries > maxEntries) {
    throw new Error(`ZIP archive contains too many entries (maximum ${maxEntries}).`);
  }
  return totalEntries;
}

/**
 * Safely extracts a ZIP archive in-memory with strict Zip Slip, Symlink, Zip Bomb, and file filtering guards.
 * Never writes to disk and never executes code.
 */
/** Recognize ZIP symlink modes regardless of JSZip's number/string representation. */
export function hasZipSymlinkPermissions(unixPerms: unknown): boolean {
  const unixMode = typeof unixPerms === 'number'
    ? unixPerms
    : typeof unixPerms === 'string' && /^[0-7]{3,6}$/.test(unixPerms)
      ? Number.parseInt(unixPerms, 8)
      : null;
  const symbolicMode = typeof unixPerms === 'string' && unixPerms.trim().startsWith('l');
  return (unixMode !== null && (unixMode & 0o170000) === 0o120000) || symbolicMode;
}

export async function safeExtractZip(
  zipInput: File | Blob | ArrayBuffer | Uint8Array,
  options?: {
    excludeDirs?: boolean;
    excludeCommonDirs?: boolean;
    excludedDirsList?: string[];
    limits?: Partial<UploadLimits>;
    archiveName?: string;
  }
): Promise<ExtractionResult> {
  const limits = { ...DEFAULT_LIMITS, ...options?.limits };
  const excludeDirs = options?.excludeDirs ?? options?.excludeCommonDirs ?? true;
  const excludedDirs = options?.excludedDirsList ?? DEFAULT_EXCLUDED_DIRS;

  // Determine size
  let byteSize = 0;
  let archiveName = options?.archiveName || 'Uploaded Project';
  if (typeof (zipInput as any).size === 'number') {
    byteSize = (zipInput as any).size;
    if ((zipInput as any).name) {
      archiveName = (zipInput as any).name;
    }
  } else if ((zipInput as any).byteLength) {
    byteSize = (zipInput as any).byteLength;
  }

  // 1. Check archive size
  if (byteSize > limits.maxArchiveSize) {
    throw new Error(
      `ZIP archive is ${(byteSize / (1024 * 1024)).toFixed(1)}MB, which exceeds the ${limits.maxArchiveSize / (1024 * 1024)}MB archive limit.`
    );
  }

  // Inspect the bounded central-directory metadata before JSZip allocates
  // archive-entry objects. Pass the already bounded bytes to the parser.
  let zipBytes: Uint8Array;
  try {
    zipBytes = zipInput instanceof Uint8Array
      ? zipInput
      : zipInput instanceof ArrayBuffer
        ? new Uint8Array(zipInput)
        : new Uint8Array(await zipInput.arrayBuffer());
    await countZipEntriesBeforeParsing(zipBytes, limits.maxArchiveEntries);
  } catch (err) {
    if (err instanceof Error && /too many entries|Multi-disk|ZIP64/.test(err.message)) throw err;
    throw new Error('Invalid or corrupted ZIP archive. Please ensure the file is a valid .zip file.');
  }

  const zip = new JSZip();
  let loadedZip: JSZip;
  try {
    loadedZip = await zip.loadAsync(zipBytes);
  } catch (err) {
    throw new Error('Invalid or corrupted ZIP archive. Please ensure the file is a valid .zip file.');
  }

  const stagedFiles: StagedFile[] = [];
  const skippedFiles: string[] = [];
  const seenPaths = new Set<string>();
  let totalExtractedSize = 0;
  let totalLineCount = 0;

  // Derive project name from zip filename
  const projectName = archiveName.replace(/\.zip$/i, '') || 'Uploaded Project';

  const entries = Object.keys(loadedZip.files);
  if (entries.length === 0) {
    throw new Error('The uploaded ZIP archive is empty.');
  }
  if (entries.length > limits.maxArchiveEntries) {
    throw new Error(`ZIP archive contains too many entries (maximum ${limits.maxArchiveEntries}).`);
  }

  for (const rawPath of entries) {
    const entry = loadedZip.files[rawPath];
    if (entry.dir) continue; // Skip directory entries

    // Check for symlinks (POSIX symlink attribute 0o120000)
    const unixPerms = (entry as any).unixPermissions;
    if (hasZipSymlinkPermissions(unixPerms)) {
      skippedFiles.push(`${rawPath} (Security: symbolic links are rejected)`);
      continue;
    }

    // Zip Slip path traversal guard & absolute path rejection
    const cleanPath = sanitizeRelativePath(rawPath);
    if (!cleanPath) {
      skippedFiles.push(`${rawPath} (Security: path traversal or ambiguous path detected)`);
      continue;
    }

    // Reject duplicate and case/Unicode-colliding paths before staging. This
    // prevents platform-dependent overwrites when projects move between OSes.
    const pathKey = cleanPath.normalize('NFC').toLocaleLowerCase('en-US');
    if (seenPaths.has(pathKey)) {
      skippedFiles.push(`${cleanPath} (Security: duplicate or case-colliding archive path rejected)`);
      continue;
    }
    seenPaths.add(pathKey);

    // Excluded directory check
    if (excludeDirs && isPathExcluded(cleanPath, excludedDirs)) {
      continue;
    }

    // Supported source file filter
    if (!isSupportedSourceFile(cleanPath)) {
      skippedFiles.push(cleanPath);
      continue;
    }

    // File count guard
    if (stagedFiles.length >= limits.maxFileCount) {
      skippedFiles.push(`${cleanPath} (File count limit reached: ${limits.maxFileCount})`);
      break;
    }

    // Check entry uncompressed size estimate for zip bomb prevention
    // @ts-ignore - internal uncompressedSize in JSZip
    const estimatedSize = entry._data?.uncompressedSize || 0;
    if (estimatedSize > limits.maxSingleFileSize) {
      skippedFiles.push(`${cleanPath} (Exceeds 2MB single file limit)`);
      continue;
    }

    if (totalExtractedSize + estimatedSize > limits.maxTotalExtractedSize) {
      throw new Error(
        `Archive contents exceed total size limit (${limits.maxTotalExtractedSize / (1024 * 1024)}MB). Possible decompression bomb or oversized repository.`
      );
    }

    // Declared ZIP sizes are untrusted. Stream decompression and enforce
    // actual per-file and remaining project budgets before buffering content.
    let extractedBytes: Uint8Array;
    try {
      extractedBytes = await extractEntryWithinLimit(
        entry,
        Math.min(limits.maxSingleFileSize, limits.maxTotalExtractedSize - totalExtractedSize)
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('actual decompressed size limit')) {
        skippedFiles.push(`${cleanPath} (Actual decompressed size exceeds the configured limit)`);
        continue;
      }
      throw new Error(`Unable to safely decompress archive entry: ${cleanPath}`);
    }
    const actualSize = extractedBytes.byteLength;
    const text = new TextDecoder('utf-8', { fatal: false }).decode(extractedBytes);

    if (actualSize === 0 || text.trim().length === 0) {
      skippedFiles.push(`${cleanPath} (Empty file: 0 bytes)`);
      continue;
    }

    if (actualSize > limits.maxSingleFileSize) {
      skippedFiles.push(`${cleanPath} (Exceeds 2MB single file limit)`);
      continue;
    }

    totalExtractedSize += actualSize;
    if (totalExtractedSize > limits.maxTotalExtractedSize) {
      throw new Error(`Total extracted source code exceeds limit of ${limits.maxTotalExtractedSize / (1024 * 1024)}MB.`);
    }

    // Check binary bytes
    if (isBinaryContent(text)) {
      skippedFiles.push(`${cleanPath} (Binary file content rejected)`);
      continue;
    }

    const lineCount = countSourceLinesWithinLimit(text, MAX_SOURCE_LINES_PER_FILE);
    if (lineCount === null) {
      skippedFiles.push(`${cleanPath} (Exceeds per-file source line limit of ${MAX_SOURCE_LINES_PER_FILE})`);
      continue;
    }
    if (totalLineCount + lineCount > MAX_SOURCE_LINES_PER_PROJECT) {
      skippedFiles.push(`${cleanPath} (Project source line limit of ${MAX_SOURCE_LINES_PER_PROJECT} reached)`);
      continue;
    }
    totalLineCount += lineCount;
    const lang = detectLanguage(cleanPath, text);
    const fileNameOnly = cleanPath.split('/').pop() || cleanPath;

    stagedFiles.push({
      id: `file-${stagedFiles.length + 1}-${Math.random().toString(36).substring(2, 7)}`,
      name: fileNameOnly,
      relativePath: cleanPath,
      size: actualSize,
      language: lang,
      content: text,
      lines: lineCount
    });
  }

  if (stagedFiles.length === 0) {
    if (skippedFiles.some(s => s.includes('Empty file'))) {
      throw new Error('All files in the archive are empty (0 bytes). Please provide files containing source code.');
    }
    if (skippedFiles.some(s => s.includes('Binary file'))) {
      throw new Error('Archive contains only binary files. Please include plain-text source code files.');
    }
    throw new Error(
      'No supported source code files were found in the archive. Supported formats include .js, .ts, .py, .go, .java, .php, .c, .cpp, .cs, .rb, .sql, .txt, etc.'
    );
  }

  return {
    stagedFiles,
    skippedFiles,
    totalExtractedSize,
    projectName
  };
}

/**
 * Processes a FileList or array of Files (from folder upload webkitdirectory or multi-file selection).
 * Preserves relative paths using file.webkitRelativePath where present.
 */
export async function processFiles(
  files: FileList | File[],
  options?: {
    excludeDirs?: boolean;
    excludeCommonDirs?: boolean;
    excludedDirsList?: string[];
    limits?: Partial<UploadLimits>;
  }
): Promise<ExtractionResult> {
  const limits = { ...DEFAULT_LIMITS, ...options?.limits };
  const excludeDirs = options?.excludeDirs ?? options?.excludeCommonDirs ?? true;
  const excludedDirs = options?.excludedDirsList ?? DEFAULT_EXCLUDED_DIRS;

  // Reject oversized selections before copying or iterating the browser FileList.
  // FileList itself is browser-owned; avoid an additional unbounded array allocation.
  if (files.length === 0) {
    throw new Error('No files were selected.');
  }
  if (files.length > limits.maxArchiveEntries) {
    throw new Error(`Selection contains too many files (maximum ${limits.maxArchiveEntries}).`);
  }

  // Derive the project name only from a validated relative path. Browser-provided
  // webkitRelativePath is still treated as untrusted input.
  const fileArray = Array.from(files);
  let projectName = 'Project Review';
  const firstWithRel = fileArray.find(f => typeof (f as any).webkitRelativePath === 'string' && (f as any).webkitRelativePath.length > 0);
  if (firstWithRel) {
    const firstPath = sanitizeRelativePath((firstWithRel as any).webkitRelativePath);
    const rootDir = firstPath?.split('/')[0];
    if (rootDir) projectName = rootDir;
  }

  const stagedFiles: StagedFile[] = [];
  const skippedFiles: string[] = [];
  let totalExtractedSize = 0;
  let totalLineCount = 0;
  const seenPaths = new Set<string>();

  for (const file of fileArray) {
    const relativePath = (file as any).webkitRelativePath;
    const rawPath = typeof relativePath === 'string' && relativePath.length > 0 ? relativePath : file.name;
    const cleanPath = sanitizeRelativePath(rawPath);

    // Never fall back to the basename when a supplied path is unsafe: doing so
    // would silently turn a rejected traversal/absolute path into an accepted file.
    if (!cleanPath) {
      skippedFiles.push('Selected file (Security: unsafe or invalid relative path rejected)');
      continue;
    }

    // Reject ambiguous duplicate paths (including case-only collisions) so that
    // different platforms cannot resolve the same project tree differently.
    const pathKey = cleanPath.normalize('NFC').toLocaleLowerCase('en-US');
    if (seenPaths.has(pathKey)) {
      skippedFiles.push(`${cleanPath} (Duplicate or case-colliding path rejected)`);
      continue;
    }
    seenPaths.add(pathKey);

    // Validate file metadata before reading content.
    if (!Number.isSafeInteger(file.size) || file.size < 0) {
      skippedFiles.push(`${cleanPath} (Invalid file size metadata)`);
      continue;
    }

    // Check directory exclusion
    if (excludeDirs && isPathExcluded(cleanPath, excludedDirs)) {
      continue;
    }

    // Supported source file check
    if (!isSupportedSourceFile(cleanPath)) {
      skippedFiles.push(cleanPath);
      continue;
    }

    // Empty file check
    if (file.size === 0) {
      skippedFiles.push(`${cleanPath} (Empty file: 0 bytes)`);
      continue;
    }

    // Single file size limit
    if (file.size > limits.maxSingleFileSize) {
      skippedFiles.push(`${cleanPath} (File exceeds 2MB limit: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
      continue;
    }

    // Cumulative size check
    if (totalExtractedSize + file.size > limits.maxTotalExtractedSize) {
      skippedFiles.push(`${cleanPath} (Project total size limit reached)`);
      break;
    }

    // File count limit
    if (stagedFiles.length >= limits.maxFileCount) {
      skippedFiles.push(`${cleanPath} (File limit of ${limits.maxFileCount} reached)`);
      break;
    }

    // Read content safely
    try {
      const content = await readFileText(file);
      // Browser File.size should match the bytes read, but treat metadata as
      // untrusted at this boundary (e.g. synthetic File-like objects in tests).
      const actualByteSize = new TextEncoder().encode(content).byteLength;
      if (actualByteSize !== file.size) {
        skippedFiles.push(`${cleanPath} (File size metadata does not match actual content)`);
        continue;
      }
      if (actualByteSize > limits.maxSingleFileSize) {
        skippedFiles.push(`${cleanPath} (Actual file content exceeds the single-file size limit)`);
        continue;
      }
      if (actualByteSize > limits.maxTotalExtractedSize - totalExtractedSize) {
        skippedFiles.push(`${cleanPath} (Actual project content exceeds the total size limit)`);
        break;
      }
      // Count bytes actually read even when the file is later rejected as
      // binary or too newline-dense; rejected inputs still consume resources.
      totalExtractedSize += actualByteSize;
      if (!content || content.trim().length === 0) {
        skippedFiles.push(`${cleanPath} (Empty file: 0 bytes)`);
        continue;
      }
      if (isBinaryContent(content)) {
        skippedFiles.push(`${cleanPath} (Binary file content detected)`);
        continue;
      }

      const lineCount = countSourceLinesWithinLimit(content, MAX_SOURCE_LINES_PER_FILE);
      if (lineCount === null) {
        skippedFiles.push(`${cleanPath} (Exceeds per-file source line limit of ${MAX_SOURCE_LINES_PER_FILE})`);
        continue;
      }
      if (totalLineCount + lineCount > MAX_SOURCE_LINES_PER_PROJECT) {
        skippedFiles.push(`${cleanPath} (Project source line limit of ${MAX_SOURCE_LINES_PER_PROJECT} reached)`);
        continue;
      }
      totalLineCount += lineCount;
      const lang = detectLanguage(cleanPath, content);
      const fileNameOnly = cleanPath.split('/').pop() || cleanPath;

      stagedFiles.push({
        id: `file-${stagedFiles.length + 1}-${Math.random().toString(36).substring(2, 7)}`,
        name: fileNameOnly,
        relativePath: cleanPath,
        size: file.size,
        language: lang,
        content,
        lines: lineCount
      });
    } catch (err) {
      skippedFiles.push(`${cleanPath} (Error reading file as UTF-8)`);
    }
  }

  if (stagedFiles.length === 0) {
    if (skippedFiles.some(s => s.includes('Empty file'))) {
      throw new Error('The selected file(s) are empty (0 bytes). Please upload files containing source code.');
    }
    if (skippedFiles.some(s => s.includes('Binary file'))) {
      throw new Error('The selected file(s) contain binary data and cannot be parsed as text source code.');
    }
    throw new Error('No supported text source code files found. Supported formats include .js, .ts, .py, .go, .java, .php, .c, .cpp, .cs, .rb, .sql, .txt, etc.');
  }

  return {
    stagedFiles,
    skippedFiles,
    totalExtractedSize,
    projectName
  };
}

// Aliases for unified upload component integration
export const processZipUpload = safeExtractZip;
export const processFolderUpload = (
  files: FileList | File[],
  options?: {
    excludeDirs?: boolean;
    excludeCommonDirs?: boolean;
    excludedDirsList?: string[];
    limits?: Partial<UploadLimits>;
  }
) => processFiles(files, options);
export const processMultipleFiles = (
  files: FileList | File[],
  options?: {
    excludeDirs?: boolean;
    excludeCommonDirs?: boolean;
    excludedDirsList?: string[];
    limits?: Partial<UploadLimits>;
  }
) => processFiles(files, options);

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => reject(new Error('Failed to read file as UTF-8 text'));
    reader.readAsText(file, 'UTF-8');
  });
}
