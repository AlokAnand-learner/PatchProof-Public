import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/components/PatchDiffViewer.tsx'), 'utf8');
const applyStart = source.indexOf('const executeApply = () => {');
const applyEnd = source.indexOf('const handleApplyClick', applyStart);
assert.ok(applyStart >= 0 && applyEnd > applyStart, 'patch apply handler must exist');
const applyHandler = source.slice(applyStart, applyEnd);

assert.ok(applyHandler.includes("if (status === 'INVALID')"), 'INVALID fixes must be blocked inside the apply handler itself');
assert.ok(applyHandler.includes('return;'), 'blocked fixes must return without applying');
assert.ok(applyHandler.includes('!Number.isInteger(startLine)') && applyHandler.includes('!Number.isInteger(endLine)'), 'line bounds must be finite integers');
assert.ok(applyHandler.includes('startLine < 1') && applyHandler.includes('endLine < startLine'), 'line bounds must be positive and ordered');
assert.ok(applyHandler.includes('startIdx >= lines.length') && applyHandler.includes('endIdx > lines.length'), 'out-of-file line ranges must be rejected');
assert.ok(applyHandler.includes("viewMode === 'full'"), 'full-file model output must remain preview-only');
assert.ok(!source.includes('Apply Anyway'), 'there must be no user-confirmation bypass for invalid patches');
assert.match(source, /disabled=\{viewMode === 'full'\}/, 'only preview-only full-file mode should disable the apply control');
console.log('Patch application safety contract: 9 assertions passed');
