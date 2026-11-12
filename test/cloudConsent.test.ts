/**
 * Regression tests for external AI transmission consent, including custom endpoints.
 */
import {
  generateAnalysisWithActiveProvider,
  requiresCloudConsent,
  setActiveProvider,
  setCloudConsent,
  setOfflineMode,
  testProviderConnection,
  updateProviderConfig
} from '../src/engine/providerEngine';

let passCount = 0;
let failCount = 0;
function assert(description: string, condition: boolean): void {
  if (condition) { console.log(`[✓ PASS] ${description}`); passCount += 1; }
  else { console.error(`[✗ FAIL] ${description}`); failCount += 1; }
}

async function run(): Promise<void> {
  assert('Hosted Gemini requires cloud-transmission consent', requiresCloudConsent('gemini'));
  assert('Hosted Gemma requires cloud-transmission consent', requiresCloudConsent('gemma'));
  assert('Ollama loopback does not require cloud-transmission consent', !requiresCloudConsent('ollama'));
  assert('Remote custom HTTPS endpoint requires cloud-transmission consent', requiresCloudConsent('custom', 'https://ai.example.com/v1'));
  assert('Trusted custom loopback endpoint does not require cloud-transmission consent', !requiresCloudConsent('custom', 'http://127.0.0.1:8000/v1'));

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  let lastUrl = '';
  try {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      fetchCalls += 1;
      lastUrl = String(input);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'mock local model response' } }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    };

    updateProviderConfig('custom', { endpoint: 'https://ai.example.com/v1' });
    setActiveProvider('custom');
    setCloudConsent(false);
    let remoteBlocked = false;
    try { await generateAnalysisWithActiveProvider('synthetic source code only'); }
    catch (error) { remoteBlocked = String(error).toLowerCase().includes('consent'); }
    assert('Remote custom endpoint is blocked before fetch when consent is absent', remoteBlocked && fetchCalls === 0);

    const remoteTest = await testProviderConnection({ provider: 'custom', model: 'mock', endpoint: 'https://ai.example.com/v1' });
    assert('Remote custom connection test is blocked before sending a request without consent', !remoteTest.success && remoteTest.message.toLowerCase().includes('consent') && fetchCalls === 0);

    const hostedTest = await testProviderConnection({ provider: 'gemini', model: 'gemini-test' });
    assert('Hosted Gemini connection test is blocked before contacting the provider without consent', !hostedTest.success && hostedTest.message.toLowerCase().includes('consent') && fetchCalls === 0);

    setCloudConsent(true);
    setOfflineMode(true);
    const offlineRemoteTest = await testProviderConnection({ provider: 'custom', model: 'mock', endpoint: 'https://ai.example.com/v1' });
    assert('Strict offline mode blocks remote custom connection tests even when consent was previously granted', !offlineRemoteTest.success && offlineRemoteTest.message.toLowerCase().includes('offline') && fetchCalls === 0);
    setOfflineMode(false);
    setCloudConsent(false);

    updateProviderConfig('custom', { endpoint: 'http://127.0.0.1:8000/v1' });
    setActiveProvider('custom');
    setCloudConsent(false);
    const localResponse = await generateAnalysisWithActiveProvider('synthetic local test prompt');
    assert('Trusted local custom endpoint can run without cloud consent', localResponse === 'mock local model response');
    assert('Local custom request is confined to the configured loopback endpoint', lastUrl === 'http://127.0.0.1:8000/v1/chat/completions');

    const localConnectionTest = await testProviderConnection({ provider: 'custom', model: 'mock', endpoint: 'http://127.0.0.1:8000/v1' });
    assert('Trusted local custom connection test remains available without cloud consent', localConnectionTest.success && lastUrl === 'http://127.0.0.1:8000/v1/models');
  } finally {
    globalThis.fetch = originalFetch;
    setCloudConsent(false);
  }

  console.log(`Cloud consent regression results: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) throw new Error('Cloud consent regression suite failed.');
}
run().catch(error => { console.error('Cloud consent regression suite failed unexpectedly:', error); throw error; });
