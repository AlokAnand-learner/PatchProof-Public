/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'http';

console.log('===========================================================');
console.log('   PATCHPROOF AUTHENTICATION BOUNDARY TEST SUITE (SEC-02)  ');
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

interface RequestOptions {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
  port?: number;
  hostname?: string;
}

function sendRawHttpRequest(options: RequestOptions): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: options.hostname || '127.0.0.1',
      port: options.port || 3000,
      path: options.path,
      method: options.method,
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runAuthBoundaryTests() {
  try {
    // 1. Session Token Generation & Bootstrap Verification
    const bootstrapRes = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/auth/session',
      headers: {
        'Host': '127.0.0.1:3000'
      }
    });

    assert('GET /api/auth/session succeeds for legitimate local client (HTTP 200)', bootstrapRes.statusCode === 200);
    const bootstrapData = JSON.parse(bootstrapRes.body || '{}');
    const validToken = bootstrapData.sessionToken;

    assert('Session token is 64 hex characters (256-bit cryptographic randomness)', typeof validToken === 'string' && /^[0-9a-f]{64}$/.test(validToken));
    assert('Deployment boundary is identified as single-user-local', bootstrapData.deploymentBoundary === 'single-user-local');

    // Ollama model discovery performs a server-side request and must require the same session boundary.
    const unauthOllamaModels = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/ollama/models',
      headers: { 'Host': '127.0.0.1:3000' }
    });
    assert('Unauthenticated GET /api/ollama/models returns HTTP 401', unauthOllamaModels.statusCode === 401);

    const authOllamaModels = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/ollama/models',
      headers: { 'Host': '127.0.0.1:3000', 'X-PatchProof-Auth': validToken }
    });
    assert('Authenticated GET /api/ollama/models is accepted (HTTP 200)', authOllamaModels.statusCode === 200);

    // 2. Unauthenticated POST /api/status/offline-mode
    const unauthOffline = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/offline-mode',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled: true })
    });
    assert('Unauthenticated POST /api/status/offline-mode returns HTTP 401', unauthOffline.statusCode === 401);

    // 3. Invalid Token POST /api/status/offline-mode
    const invalidTokenOffline = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/offline-mode',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': 'forged-token-abc123xyz'
      },
      body: JSON.stringify({ enabled: true })
    });
    assert('Invalid token POST /api/status/offline-mode returns HTTP 401', invalidTokenOffline.statusCode === 401);

    // 4. Authenticated POST /api/status/offline-mode
    const authOffline = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/offline-mode',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ enabled: false })
    });
    assert('Authenticated POST /api/status/offline-mode with valid token succeeds (HTTP 200)', authOffline.statusCode === 200);

    // 5. Unauthenticated POST /api/provider/config
    const unauthConfig = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/provider/config',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider: 'gemini' })
    });
    assert('Unauthenticated POST /api/provider/config returns HTTP 401', unauthConfig.statusCode === 401);

    // 6. Invalid Token POST /api/provider/config
    const invalidTokenConfig = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/provider/config',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': 'malicious-attacker-token'
      },
      body: JSON.stringify({ provider: 'gemini' })
    });
    assert('Invalid token POST /api/provider/config returns HTTP 401', invalidTokenConfig.statusCode === 401);

    // 7. Authenticated POST /api/provider/config with Bearer header variant
    const authConfig = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/provider/config',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`
      },
      body: JSON.stringify({ provider: 'ollama', selectedModel: 'gemma2:9b' })
    });
    assert('Authenticated POST /api/provider/config with Bearer header succeeds (HTTP 200)', authConfig.statusCode === 200);

    // 8. Unauthenticated POST /api/provider/activate
    const unauthActivate = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/provider/activate',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider: 'ollama' })
    });
    assert('Unauthenticated POST /api/provider/activate returns HTTP 401', unauthActivate.statusCode === 401);

    // 9. Invalid Token POST /api/provider/activate
    const invalidTokenActivate = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/provider/activate',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': 'bogus-activate-token'
      },
      body: JSON.stringify({ provider: 'ollama' })
    });
    assert('Invalid token POST /api/provider/activate returns HTTP 401', invalidTokenActivate.statusCode === 401);

    // 10. Authenticated POST /api/provider/activate
    const authActivate = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/provider/activate',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ provider: 'gemini' })
    });
    assert('Authenticated POST /api/provider/activate with valid token succeeds (HTTP 200)', authActivate.statusCode === 200);

    const invalidModelActivate = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/provider/activate',
      headers: { 'Host': '127.0.0.1:3000', 'Content-Type': 'application/json', 'X-PatchProof-Auth': validToken },
      body: JSON.stringify({ provider: 'ollama', model: 'invalid\nmodel' })
    });
    assert('Provider activation rejects model identifiers containing control characters (HTTP 400)', invalidModelActivate.statusCode === 400);

    // 11. Additional Sensitive Mutating Endpoints: DELETE /api/provider/config/:provider
    const unauthDelete = await sendRawHttpRequest({
      method: 'DELETE',
      path: '/api/provider/config/custom',
      headers: {
        'Host': '127.0.0.1:3000'
      }
    });
    assert('Unauthenticated DELETE /api/provider/config/:provider returns HTTP 401', unauthDelete.statusCode === 401);

    // 12. Additional Sensitive Mutating Endpoints: POST /api/provider/test
    const unauthTestProv = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/provider/test',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider: 'ollama' })
    });
    assert('Unauthenticated POST /api/provider/test returns HTTP 401', unauthTestProv.statusCode === 401);

    // 13. Host Header Validation: Legitimate Loopback 127.0.0.1:3000
    const legitimateHost1 = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/status',
      headers: {
        'Host': '127.0.0.1:3000'
      }
    });
    assert('Host header "127.0.0.1:3000" passes validation (HTTP 200)', legitimateHost1.statusCode === 200);

    // 14. Host Header Validation: Legitimate Loopback localhost:3000
    const legitimateHost2 = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/status',
      headers: {
        'Host': 'localhost:3000'
      }
    });
    assert('Host header "localhost:3000" passes validation (HTTP 200)', legitimateHost2.statusCode === 200);

    // 15. Host Header Validation: Unauthorized External Host (DNS Rebinding Attack)
    const unauthorizedHost = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/status',
      headers: {
        'Host': 'evil.attacker.com'
      }
    });
    assert('Unauthorized Host "evil.attacker.com" returns HTTP 403 Forbidden', unauthorizedHost.statusCode === 403);

    // 16. Host Header Validation: Subdomain/Suffix DNS Rebinding Trick
    const suffixHost = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/status',
      headers: {
        'Host': '127.0.0.1.attacker.net:3000'
      }
    });
    assert('Suffix attack Host "127.0.0.1.attacker.net:3000" returns HTTP 403 Forbidden', suffixHost.statusCode === 403);

    // 17. Origin Validation: Trusted localhost Origin can obtain session token
    const originLocalhost = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/auth/session',
      headers: {
        'Host': '127.0.0.1:3000',
        'Origin': 'http://localhost:3000'
      }
    });
    assert('Trusted localhost Origin obtains session token (HTTP 200)', originLocalhost.statusCode === 200);

    // 18. Origin Validation: Trusted 127.0.0.1 Origin can obtain session token
    const originLoopback = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/auth/session',
      headers: {
        'Host': '127.0.0.1:3000',
        'Origin': 'http://127.0.0.1:3000'
      }
    });
    assert('Trusted 127.0.0.1 Origin obtains session token (HTTP 200)', originLoopback.statusCode === 200);

    // 19. Origin Validation: Untrusted external Origin is rejected (HTTP 403 Forbidden)
    const originUntrusted = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/auth/session',
      headers: {
        'Host': '127.0.0.1:3000',
        'Origin': 'https://evil.attacker.com'
      }
    });
    assert('Untrusted Origin "https://evil.attacker.com" receives HTTP 403 Forbidden', originUntrusted.statusCode === 403);

    // 20. Origin Validation: Deceptive suffix Origin is rejected (HTTP 403 Forbidden)
    const originSuffixTrick = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/auth/session',
      headers: {
        'Host': '127.0.0.1:3000',
        'Origin': 'http://localhost.evil.com'
      }
    });
    assert('Deceptive suffix Origin "http://localhost.evil.com" receives HTTP 403 Forbidden', originSuffixTrick.statusCode === 403);

    // 21. Origin Validation: Malformed Origin is rejected (HTTP 403 Forbidden)
    const originMalformed = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/auth/session',
      headers: {
        'Host': '127.0.0.1:3000',
        'Origin': 'not-a-valid-url-format'
      }
    });
    assert('Malformed Origin receives HTTP 403 Forbidden', originMalformed.statusCode === 403);

    // 22. Cross-Site Metadata: Sec-Fetch-Site: cross-site is rejected (HTTP 403 Forbidden)
    const crossSiteFetch = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/auth/session',
      headers: {
        'Host': '127.0.0.1:3000',
        'Sec-Fetch-Site': 'cross-site'
      }
    });
    assert('Request with "Sec-Fetch-Site: cross-site" receives HTTP 403 Forbidden', crossSiteFetch.statusCode === 403);

    // 23. Origin Validation: Missing Origin preserved for legitimate local CLI / curl workflows
    const missingOrigin = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/auth/session',
      headers: {
        'Host': '127.0.0.1:3000'
      }
    });
    assert('Missing Origin remains compatible with legitimate local CLI workflows (HTTP 200)', missingOrigin.statusCode === 200);

    // 24. Origin Validation: Legitimate Google Cloud Run preview Origin allowed
    const cloudRunOrigin = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/auth/session',
      headers: {
        'Host': '127.0.0.1:3000',
        'Origin': 'https://ais-dev-applet-12345.asia-southeast1.run.app'
      }
    });
    assert('Non-local Cloud Run preview Origin is rejected by strict local-only boundary (HTTP 403)', cloudRunOrigin.statusCode === 403);

    // 25. State Mutation: Unauthenticated POST /api/set-offline-mode
    const unauthSetOffline = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/set-offline-mode',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled: true })
    });
    assert('Unauthenticated POST /api/set-offline-mode returns HTTP 401', unauthSetOffline.statusCode === 401);

    // 26. State Mutation: Authenticated POST /api/set-offline-mode
    const authSetOffline = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/set-offline-mode',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ enabled: true })
    });
    assert('Authenticated POST /api/set-offline-mode with valid token succeeds (HTTP 200)', authSetOffline.statusCode === 200);

    // 27. State Mutation: Unauthenticated POST /api/set-cloud-consent
    const unauthSetConsent = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/set-cloud-consent',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ granted: true })
    });
    assert('Unauthenticated POST /api/set-cloud-consent returns HTTP 401', unauthSetConsent.statusCode === 401);

    // 28. State Mutation: Authenticated POST /api/set-cloud-consent
    const authSetConsent = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/set-cloud-consent',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ granted: false })
    });
    assert('Authenticated POST /api/set-cloud-consent with valid token succeeds (HTTP 200)', authSetConsent.statusCode === 200);

    // The Settings UI uses /api/status/cloud-consent; verify its authentication and request contract.
    const unauthStatusConsent = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/cloud-consent',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ granted: true })
    });
    assert('Unauthenticated POST /api/status/cloud-consent returns HTTP 401', unauthStatusConsent.statusCode === 401);

    const authStatusConsent = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/cloud-consent',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ granted: true })
    });
    const authStatusConsentData = JSON.parse(authStatusConsent.body || '{}');
    assert('Authenticated POST /api/status/cloud-consent accepts { granted: true }', authStatusConsent.statusCode === 200 && authStatusConsentData.cloudConsentGranted === true);

    const invalidStatusConsent = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/cloud-consent',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ granted: 'false' })
    });
    assert('Cloud consent route rejects non-boolean values instead of coercing them to true', invalidStatusConsent.statusCode === 400);

    const statusAfterConsent = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/status',
      headers: { 'Host': '127.0.0.1:3000' }
    });
    const statusAfterConsentData = JSON.parse(statusAfterConsent.body || '{}');
    assert('Cloud consent state is reflected by GET /api/status', statusAfterConsent.statusCode === 200 && statusAfterConsentData.cloudConsentGranted === true);

    const revokeStatusConsent = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/cloud-consent',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ granted: false })
    });
    const revokeStatusConsentData = JSON.parse(revokeStatusConsent.body || '{}');
    assert('Cloud consent can be revoked through the Settings route', revokeStatusConsent.statusCode === 200 && revokeStatusConsentData.cloudConsentGranted === false);

    // 29. State Mutation: Unauthenticated POST /api/set-active-provider
    const unauthSetActiveProv = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/set-active-provider',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider: 'gemini' })
    });
    assert('Unauthenticated POST /api/set-active-provider returns HTTP 401', unauthSetActiveProv.statusCode === 401);

    // 30. State Mutation: Authenticated POST /api/set-active-provider
    const authSetActiveProv = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/set-active-provider',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ provider: 'ollama' })
    });
    assert('Authenticated POST /api/set-active-provider with valid token succeeds (HTTP 200)', authSetActiveProv.statusCode === 200);

    // A caller-supplied allowCloudAi flag must never override server-side consent.
    const disableOfflineForConsentTest = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/offline-mode',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ enabled: false })
    });
    assert('Offline mode can be disabled for cloud-consent regression', disableOfflineForConsentTest.statusCode === 200);

    const selectGeminiForConsentTest = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/set-active-provider',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ provider: 'gemini' })
    });
    assert('Cloud provider can be selected for consent regression', selectGeminiForConsentTest.statusCode === 200);

    const revokeBeforeAnalyze = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/cloud-consent',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ granted: false })
    });
    assert('Cloud consent is revoked before testing request override', revokeBeforeAnalyze.statusCode === 200);

    const allowCloudOverrideAnalyze = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/analyze',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({
        code: 'const syntheticInput = "safe-test";',
        language: 'javascript',
        fileName: 'consent-test.js',
        allowCloudAi: true
      })
    });
    const allowCloudOverrideData = JSON.parse(allowCloudOverrideAnalyze.body || '{}');
    assert('Request allowCloudAi:true cannot bypass revoked cloud consent', allowCloudOverrideAnalyze.statusCode === 200 && allowCloudOverrideData.transmissionMode === 'LOCAL_ONLY' && allowCloudOverrideData.cloudDisclosed === false);

    // Restore the local provider for the remaining API boundary checks.
    const restoreLocalProvider = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/set-active-provider',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ provider: 'ollama' })
    });
    assert('Local provider is restored after cloud-consent regression', restoreLocalProvider.statusCode === 200);

    // 31. State Mutation: Unauthenticated POST /api/config
    const unauthConfigAlias = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/config',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider: 'ollama', config: { selectedModel: 'gemma2:9b' } })
    });
    assert('Unauthenticated POST /api/config returns HTTP 401', unauthConfigAlias.statusCode === 401);

    // 32. State Mutation: Authenticated POST /api/config
    const authConfigAlias = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/config',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ provider: 'ollama', config: { selectedModel: 'gemma2:9b' } })
    });
    assert('Authenticated POST /api/config with valid token succeeds (HTTP 200)', authConfigAlias.statusCode === 200);

    // 33. State Mutation: Unauthenticated POST /api/test-connection
    const unauthTestConn = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/test-connection',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider: 'ollama' })
    });
    assert('Unauthenticated POST /api/test-connection returns HTTP 401', unauthTestConn.statusCode === 401);

    // 34. Host Validation: Deceptive evil.run.app host rejected
    const evilRunAppHost = await sendRawHttpRequest({
      method: 'GET',
      path: '/api/status',
      headers: {
        'Host': 'evil.run.app'
      }
    });
    assert('Deceptive Host "evil.run.app" returns HTTP 403 Forbidden', evilRunAppHost.statusCode === 403);

    // 35. Session Auth Timing Safety: Same length (64-char) fake token rejected with 401
    const fake64Token = '0'.repeat(64);
    const forgedTokenRes = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/offline-mode',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': fake64Token
      },
      body: JSON.stringify({ enabled: true })
    });
    assert('Forged 64-character token safely rejected by timingSafeEqual (HTTP 401)', forgedTokenRes.statusCode === 401);

    // 36. Mutating Route Protection: Unauthenticated POST /api/analyze
    const unauthAnalyze = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/analyze',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code: 'const x = 1;' })
    });
    assert('Unauthenticated POST /api/analyze returns HTTP 401', unauthAnalyze.statusCode === 401);

    const unauthMalformedAnalyze = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/analyze',
      headers: { 'Host': '127.0.0.1:3000', 'Content-Type': 'application/json' },
      body: '{malformed-and-untrusted-json'
    });
    assert('Unauthenticated malformed JSON is rejected with HTTP 401 before body parsing', unauthMalformedAnalyze.statusCode === 401);

    // 37. Mutating Route Protection: Authenticated POST /api/analyze
    const authAnalyze = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/analyze',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ code: 'const x = 1;', language: 'javascript', fileName: 'test.js' })
    });
    assert('Authenticated POST /api/analyze with valid token succeeds (HTTP 200)', authAnalyze.statusCode === 200);

    // Server-side multi-file validation must not trust client path/language metadata.
    const multiFileBoundary = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/analyze',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({
        projectName: 'Upload boundary regression',
        files: [
          { filePath: '../../outside/secret.ts', content: 'const secret = 1;', language: 'shell' },
          { filePath: 'src/Safe.ts', content: 'const safe = 1;', language: 'shell' },
          { filePath: 'src/safe.ts', content: 'const duplicate = 2;', language: 'python' }
        ]
      })
    });
    const multiFileData = JSON.parse(multiFileBoundary.body || '{}');
    assert('Multi-file analysis rejects traversal paths and case-colliding duplicates', multiFileBoundary.statusCode === 200 && Array.isArray(multiFileData.files) && multiFileData.files.length === 1 && multiFileData.files[0].filePath === 'src/Safe.ts');
    assert('Multi-file analysis reports rejected entries to the caller', multiFileBoundary.statusCode === 200 && multiFileData.skippedCount === 2 && multiFileData.skippedFiles?.length === 2);
    assert('Multi-file analysis derives language from validated filename rather than client metadata', multiFileBoundary.statusCode === 200 && multiFileData.files?.[0]?.language === 'typescript');

    const rejectedOnlyUpload = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/analyze',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ files: [{ filePath: '../../outside/only.ts', content: 'const x = 1;' }] })
    });
    assert('Multi-file analysis returns HTTP 400 when every submitted file is rejected', rejectedOnlyUpload.statusCode === 400);

    // Upload-to-analysis integration: keep the hosted provider selected but revoke consent,
    // so this test exercises the real server upload and static analyzer without remote transmission.
    const selectGeminiForStaticUpload = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/set-active-provider',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ provider: 'gemini' })
    });
    assert('Hosted provider can be selected for static upload integration', selectGeminiForStaticUpload.statusCode === 200);

    const revokeConsentForStaticUpload = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/status/cloud-consent',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ granted: false })
    });
    assert('Cloud consent remains revoked for static upload integration', revokeConsentForStaticUpload.statusCode === 200);

    const uploadToAnalysis = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/analyze',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({
        projectName: 'Local upload integration',
        files: [{
          filePath: 'src/userStore.ts',
          content: [
            'function load(req) {',
            '  const original = req.query.name;',
            '  const alias = original;',
            '  db.query("SELECT * FROM users WHERE name=\'" + alias + "\'");',
            '}',
          ].join('\\n'),
        }]
      })
    });
    const uploadAnalysisData = JSON.parse(uploadToAnalysis.body || '{}');
    assert('Uploaded source is analyzed by the running server (HTTP 200)', uploadToAnalysis.statusCode === 200);
    assert('Upload analysis returns the validated relative file path', uploadAnalysisData.files?.[0]?.filePath === 'src/userStore.ts');
    assert('Static analysis returns source-grounded SQL review evidence', uploadAnalysisData.findings?.some((finding: any) => finding.cwe?.startsWith('CWE-89')));
    assert('No cloud transmission occurs without consent during upload analysis', uploadAnalysisData.transmissionMode === 'LOCAL_ONLY' && uploadAnalysisData.cloudDisclosed === false);

    const restoreLocalAfterUpload = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/set-active-provider',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({ provider: 'ollama' })
    });
    assert('Local provider is restored after upload integration', restoreLocalAfterUpload.statusCode === 200);

    // 38. Mutating Route Protection: Unauthenticated POST /api/fix/validate
    const unauthFixVal = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/fix/validate',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ suggestedPatch: 'safeCode()' })
    });
    assert('Unauthenticated POST /api/fix/validate returns HTTP 401', unauthFixVal.statusCode === 401);

    // 39. Mutating Route Protection: Unauthenticated POST /api/validate-fix
    const unauthValidateFix = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/validate-fix',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fixedCode: 'safeCode()' })
    });
    assert('Unauthenticated POST /api/validate-fix returns HTTP 401', unauthValidateFix.statusCode === 401);

    // 40. Mutating Route Protection: Authenticated POST /api/validate-fix
    const authValidateFix = await sendRawHttpRequest({
      method: 'POST',
      path: '/api/validate-fix',
      headers: {
        'Host': '127.0.0.1:3000',
        'Content-Type': 'application/json',
        'X-PatchProof-Auth': validToken
      },
      body: JSON.stringify({
        originalCode: 'eval(userInput);',
        fixedCode: 'JSON.parse(userInput);',
        vulnerability: 'CWE-95'
      })
    });
    assert('Authenticated POST /api/validate-fix with valid token succeeds (HTTP 200)', authValidateFix.statusCode === 200);

    console.log('===========================================================');
    console.log(`Results: ${passCount} passed, ${failCount} failed.`);
    if (failCount === 0) {
      console.log('✓ ALL AUTHENTICATION BOUNDARY & HOST VALIDATION TESTS PASSED.');
      process.exit(0);
    } else {
      console.error('✗ SOME AUTHENTICATION BOUNDARY TESTS FAILED.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runAuthBoundaryTests();
