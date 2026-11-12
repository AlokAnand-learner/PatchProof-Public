import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const settings = fs.readFileSync(path.join(process.cwd(), 'src/components/SettingsView.tsx'), 'utf8');

assert.match(settings, /role="switch"[\s\S]{0,160}aria-checked=\{privacyModeEnabled\}/,
  'privacy control must expose switch semantics and its current state');
assert.ok(settings.includes('useState<boolean>(() => isPrivacyModeEnabled())'), 'privacy switch state must be initialized from persisted preference');
assert.ok(settings.includes('setPrivacyModeEnabled(nextState)'), 'privacy switch must update React state after a successful preference change');
assert.match(settings, /aria-label="Enable privacy mode for saved source code"/,
  'privacy switch must have an accessible name');
assert.match(settings, /role="switch"[\s\S]{0,220}aria-checked=\{Boolean\(serverStatus\?\.cloudConsentGranted\)\}/,
  'cloud consent control must expose switch semantics and server-backed state');
assert.match(settings, /disabled=\{!serverStatus \|\| serverStatus\.status === 'offline'\}/,
  'cloud consent must not be toggled before server status is known');
assert.match(settings, /aria-label="Allow source code transmission to the selected cloud AI provider"/,
  'cloud consent switch must clearly disclose its effect');
assert.ok(settings.includes('setBenchmarkError('), 'benchmark failures must be surfaced in the UI');
assert.ok(settings.includes("role=\"alert\" className=\"text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3\""),
  'benchmark failure must be announced as an alert');
assert.ok(settings.includes("evalResult.falsePositives === 0 ? '0 FP Target Met' : 'False-positive target not met'"),
  'false-positive target status must reflect the measured result');
assert.ok(settings.includes('severity, status, file, and text filters are available in the Results view'),
  'settings must accurately describe existing result filters');
assert.doesNotMatch(settings, /Runs 13 built-in synthetic fixtures/,
  'benchmark description must not hard-code an outdated fixture count');

console.log('Settings accessibility and feedback contract: 10 assertions passed');
