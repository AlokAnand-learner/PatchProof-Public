/**
 * Prototype Pollution Security Regression Test (SEC-01)
 * Verifies that dangerous keys (__proto__, constructor, toString, etc.)
 * cannot pollute Object.prototype or modify provider configuration,
 * and that unknown provider identifiers are strictly rejected.
 */
import { updateProviderConfig, setActiveProvider, removeProviderConfig, isValidProvider, ALLOWED_PROVIDERS } from '../src/engine/providerEngine';

console.log('===========================================================');
console.log('   PATCHPROOF PROTOTYPE POLLUTION REGRESSION TEST (SEC-01) ');
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

// 1. Verify prototype properties are clean before tests
assert('Object.prototype.apiKey is undefined before test', ({} as any).apiKey === undefined);
assert('Object.prototype.isConfigured is undefined before test', ({} as any).isConfigured === undefined);
assert('Object.prototype.polluted is undefined before test', ({} as any).polluted === undefined);

// 2. Reject __proto__ in updateProviderConfig
let protoCaught = false;
try {
  updateProviderConfig('__proto__' as any, { apiKey: 'malicious_polluted_key' });
} catch (err: any) {
  protoCaught = true;
}
assert('updateProviderConfig throws error on __proto__', protoCaught);
assert('Object.prototype was not polluted via __proto__', ({} as any).apiKey === undefined);

// 3. Reject constructor in updateProviderConfig
let constructorCaught = false;
try {
  updateProviderConfig('constructor' as any, { apiKey: 'malicious_constructor_key' });
} catch (err: any) {
  constructorCaught = true;
}
assert('updateProviderConfig throws error on constructor', constructorCaught);

// 4. Reject toString in updateProviderConfig
let toStringCaught = false;
try {
  updateProviderConfig('toString' as any, { selectedModel: 'polluted_model' });
} catch (err: any) {
  toStringCaught = true;
}
assert('updateProviderConfig throws error on toString', toStringCaught);

// 5. Reject arbitrary unknown provider identifiers
let unknownCaught = false;
try {
  setActiveProvider('evil_nonexistent_provider' as any);
} catch (err: any) {
  unknownCaught = true;
}
assert('setActiveProvider throws error on unknown provider', unknownCaught);

// 6. Reject unknown provider in removeProviderConfig
let removeCaught = false;
try {
  removeProviderConfig('prototype' as any);
} catch (err: any) {
  removeCaught = true;
}
assert('removeProviderConfig throws error on prototype', removeCaught);

// 7. Verify isValidProvider accurately checks against allowlist
assert('isValidProvider accepts legitimate provider "gemini"', isValidProvider('gemini'));
assert('isValidProvider accepts legitimate provider "ollama"', isValidProvider('ollama'));
assert('isValidProvider rejects "__proto__"', !isValidProvider('__proto__'));
assert('isValidProvider rejects "constructor"', !isValidProvider('constructor'));
assert('isValidProvider rejects "toString"', !isValidProvider('toString'));
assert('isValidProvider rejects non-string values', !isValidProvider(12345));

// 8. Verify legitimate provider configuration still works properly
let legitimateSuccess = false;
try {
  updateProviderConfig('ollama', { selectedModel: 'gemma2:9b', endpoint: 'http://127.0.0.1:11434' });
  legitimateSuccess = true;
} catch (err) {
  legitimateSuccess = false;
}
assert('Legitimate provider configuration update succeeds', legitimateSuccess);

// 9. Reject malformed provider configuration values before mutating state.
let malformedConfigCaught = false;
try {
  updateProviderConfig('ollama', null as any);
} catch {
  malformedConfigCaught = true;
}
assert('Reject null provider configuration objects', malformedConfigCaught);

let unknownFieldCaught = false;
try {
  updateProviderConfig('ollama', { unexpected: 'value' } as any);
} catch {
  unknownFieldCaught = true;
}
assert('Reject unrecognized provider configuration fields', unknownFieldCaught);

let oversizedModelCaught = false;
try {
  updateProviderConfig('ollama', { selectedModel: 'm'.repeat(129) });
} catch {
  oversizedModelCaught = true;
}
assert('Reject oversized model identifiers', oversizedModelCaught);

let malformedKeyCaught = false;
try {
  updateProviderConfig('ollama', { apiKey: 'line1\nline2' });
} catch {
  malformedKeyCaught = true;
}
assert('Reject API keys containing line breaks', malformedKeyCaught);

let oversizedEndpointCaught = false;
try {
  updateProviderConfig('ollama', { endpoint: 'http://localhost/' + 'a'.repeat(2048) });
} catch {
  oversizedEndpointCaught = true;
}
assert('Reject oversized provider endpoints', oversizedEndpointCaught);

// 10. Final prototype clean check
assert('Object.prototype remained completely unpolluted after all attempts', ({} as any).apiKey === undefined && ({} as any).isConfigured === undefined);

console.log('===========================================================');
console.log(`Results: ${passCount} passed, ${failCount} failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✓ ALL PROTOTYPE POLLUTION TESTS PASSED.');
  process.exit(0);
}
