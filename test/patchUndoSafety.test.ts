import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const results = fs.readFileSync(path.join(process.cwd(), 'src/components/ResultsView.tsx'), 'utf8');
const app = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

assert.ok(results.includes('originalCode: string;') && results.includes('appliedCode: string;'),
  'undo snapshot must retain both the pre-apply and post-apply source');
assert.ok(results.includes('undoSnapshot.scanId === scan.id'),
  'undo must be scoped to the scan where the patch was applied');
assert.ok(results.includes('undoCurrentCode === undoSnapshot.appliedCode'),
  'undo must be disabled if the source changed after the patch');
assert.ok(results.includes('setUndoSnapshot({') && results.includes('appliedCode: newCode'),
  'applying a patch must capture the exact before/after source');
assert.ok(results.includes('if (!undoSnapshot || !canUndoLastPatch) return;'),
  'undo must fail closed when the saved patch no longer matches');
assert.ok(results.includes('onApplyPatchToSource(undoSnapshot.originalCode, undoSnapshot.filePath)'),
  'undo must restore the exact pre-apply source to the correct file');
assert.ok(results.includes('setUndoSnapshot(null)') && results.includes('Undo Last Patch'),
  'undo must clear its one-step snapshot and expose an explicit control');
assert.ok(app.includes('originalCode: scanResult.isMultiFile ? scanResult.originalCode : newCode'),
  'single-file scan state must track applied source for safe undo checks');
assert.ok(app.includes('content: newCode, patchedContent: newCode'),
  'multi-file scan state must track the exact applied file content');

console.log('Patch apply/undo integration contract: 9 assertions passed');
