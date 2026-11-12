import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/components/PatchDiffViewer.tsx'), 'utf8');
const applyStart = source.indexOf('const executeApply = () => {');
const applyEnd = source.indexOf('const handleApplyClick', applyStart);
assert.ok(applyStart >= 0 && applyEnd > applyStart, 'patch apply handler must exist');
const applyHandler = source.slice(applyStart, applyEnd);

assert.ok(applyHandler.includes('applyValidatedSnippetPatch'), 'the UI must delegate patch application to the guarded helper');
assert.ok(applyHandler.includes('if (!result.ok)'), 'the UI must block every failed helper result');
assert.ok(applyHandler.includes('return;'), 'blocked fixes must return without applying');
assert.ok(source.includes('Review Required'), 'unvalidated fixes must be clearly labelled for review');
assert.ok(applyHandler.includes("viewMode === 'full'"), 'full-file model output must remain preview-only');
assert.ok(!source.includes('Apply Anyway'), 'there must be no user-confirmation bypass for invalid patches');
assert.match(source, /disabled=\{viewMode === 'full'\}/, 'only preview-only full-file mode should disable the apply control');
console.log('Patch application UI contract: 5 assertions passed');
