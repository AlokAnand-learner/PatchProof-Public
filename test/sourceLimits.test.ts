import assert from 'node:assert/strict';
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
