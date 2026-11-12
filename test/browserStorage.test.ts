import assert from 'node:assert/strict';
import { readBrowserPreference, writeBrowserPreference } from '../src/utils/browserStorage';

class TestStorage {
  values = new Map<string, string>();
  failReads = false;
  failWrites = false;
  getItem(key: string): string | null {
    if (this.failReads) throw new Error('Storage read blocked');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('Storage write blocked');
    this.values.set(key, value);
  }
}

const storage = new TestStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

assert.equal(readBrowserPreference('theme'), null, 'missing preference returns null');
assert.equal(writeBrowserPreference('theme', 'dark'), true);
assert.equal(readBrowserPreference('theme'), 'dark');
assert.equal(writeBrowserPreference('', 'dark'), false);
assert.equal(writeBrowserPreference('theme', 'x'.repeat(1001)), false);
assert.equal(readBrowserPreference('x'.repeat(201)), null);

storage.failReads = true;
assert.equal(readBrowserPreference('theme'), null, 'blocked storage reads must not crash app initialization');
storage.failReads = false;
storage.failWrites = true;
assert.equal(writeBrowserPreference('theme', 'light'), false, 'blocked writes must be reported without throwing');

console.log('Browser preference storage resilience: 8 assertions passed');
