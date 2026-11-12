import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  countSourceLinesWithinLimit,
  MAX_SOURCE_LINES_PER_FILE,
  MAX_SOURCE_LINES_PER_PROJECT
} from '../src/utils/sourceLimits';

assert.equal(countSourceLinesWithinLimit('', 1), 1);
assert.equal(countSourceLinesWithinLimit('one', 1), 1);
assert.equal(countSourceLinesWithinLimit('one\ntwo', 2), 2);
assert.equal(countSourceLinesWithinLimit('one\ntwo\n', 3), 3);
assert.equal(countSourceLinesWithinLimit('one\ntwo', 1), null);
assert.equal(countSourceLinesWithinLimit('x'.repeat(1000), 0), null);
assert.equal(countSourceLinesWithinLimit('x\n'.repeat(MAX_SOURCE_LINES_PER_FILE - 1), MAX_SOURCE_LINES_PER_FILE), MAX_SOURCE_LINES_PER_FILE);
assert.equal(countSourceLinesWithinLimit('x\n'.repeat(MAX_SOURCE_LINES_PER_FILE), MAX_SOURCE_LINES_PER_FILE), null);
assert.equal(countSourceLinesWithinLimit('x\n'.repeat(MAX_SOURCE_LINES_PER_PROJECT), MAX_SOURCE_LINES_PER_PROJECT), null);
console.log('Source line resource-bound tests: 9 passed');

const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
const multiCountIndex = serverSource.indexOf('countSourceLinesWithinLimit(fileContent');
const multiSplitIndex = serverSource.indexOf("fileContent.split('\\n')", multiCountIndex);
assert.ok(multiCountIndex >= 0 && multiSplitIndex > multiCountIndex, 'multi-file route must count lines before allocating split arrays');
assert.ok(serverSource.includes('MAX_SOURCE_LINES_PER_PROJECT'), 'multi-file route must enforce a project-wide line budget');
const singleCountIndex = serverSource.indexOf('countSourceLinesWithinLimit(code');
const singleSplitIndex = serverSource.indexOf("code.split('\\n')", singleCountIndex);
assert.ok(singleCountIndex >= 0 && singleSplitIndex > singleCountIndex, 'single-file route must count lines before allocating split arrays');
assert.ok(serverSource.includes('MAX_SOURCE_LINES_PER_FILE'), 'both analysis routes must enforce a per-file line budget');
console.log('Server source line limit integration: 4 assertions passed.');
