/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProviderType, ProviderConfig, OllamaModelInfo, SystemStatus } from '../types/security';
import { validateEndpointUrl, sanitizeErrorMessage } from '../utils/ssrfValidator';
import { normalizeModelName } from '../utils/modelName';
import { readResponseTextLimited, parseProviderJson } from '../utils/httpResponse';
import { prepareUntrustedSource, redactLikelySecrets, UntrustedSourceFile } from './untrustedSourceBoundary';
import { fetchPinnedHttpsResponseText } from '../utils/pinnedHttps';

export interface PreparedProviderReviewPayload {
  systemInstruction: string;
  userPayload: string;
  needsCloudConsent: boolean;
}

/** Build a provider payload while keeping client/file text outside trusted instructions. */
export function prepareProviderReviewPayload(
  provider: ProviderType,
  endpoint: string | undefined,
  prompt: string,
  sourceFiles?: readonly UntrustedSourceFile[],
): PreparedProviderReviewPayload {
  const needsCloudConsent = requiresCloudConsent(provider, endpoint);
  const submittedFiles: readonly UntrustedSourceFile[] = sourceFiles && sourceFiles.length > 0
    ? sourceFiles
    : [{ path: 'user-input.txt', content: prompt }];
  if (typeof prompt !== 'string' || prompt.length > 8000) {
    throw new Error('Review request must be a string of at most 8000 characters.');
  }
  const outboundFiles = needsCloudConsent ? redactLikelySecrets(submittedFiles) : submittedFiles;
  const prepared = prepareUntrustedSource(outboundFiles);
  // The review request can originate from the client. Keep it in the user-data
  // channel even when uploaded files are present; never promote it to a system instruction.
  const outboundReviewRequest = needsCloudConsent
    ? redactLikelySecrets([{ path: 'review-request.txt', content: prompt }])[0].content
    : prompt;
  const userPayload = sourceFiles && sourceFiles.length > 0
    ? JSON.stringify({
        reviewRequest: outboundReviewRequest,
        sourcePayload: JSON.parse(prepared.userPayload),
      })
    : prepared.userPayload;
  return {
    systemInstruction: prepared.systemInstruction,
    userPayload,
    needsCloudConsent,
  };
}

export interface ProviderState {
  activeProvider: ProviderType;
  activeModel: string;
  offlineMode: boolean;
  cloudConsentGranted: boolean;
  providers: Record<ProviderType, {
    selectedModel: string;
    apiKey?: string;
    endpoint?: string;
    isConfigured: boolean;
  }>;
}

// In-memory server-side state for providers and credentials
const state: ProviderState = {
  activeProvider: 'gemini',
  activeModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  offlineMode: false,
  cloudConsentGranted: false,
  providers: {
    gemini: {
      selectedModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      apiKey: process.env.GEMINI_API_KEY || '',
      isConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    },
    gemma: {
      selectedModel: 'gemma-2-9b-it',
      apiKey: process.env.GEMINI_API_KEY || '',
      endpoint: 'https://generativelanguage.googleapis.com',
      isConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    },
    openai: {
      selectedModel: 'gpt-4o-mini',
      endpoint: 'https://api.openai.com/v1',
      isConfigured: false,
    },
    anthropic: {
      selectedModel: 'claude-3-5-sonnet-20241022',
      endpoint: 'https://api.anthropic.com/v1',
      isConfigured: false,
    },
    ollama: {
      selectedModel: 'gemma2:9b',
      endpoint: 'http://127.0.0.1:11434',
      isConfigured: true,
    },
    custom: {
      selectedModel: 'custom-model',
      endpoint: 'http://127.0.0.1:8000/v1',
      isConfigured: false,
    },
  },
};

export const DEFAULT_MODELS: Record<ProviderType, string[]> = {
  gemini: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-4-argon'],
  gemma: ['gemma-2-9b-it', 'gemma-2-27b-it', 'gemma-2-2b-it'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  ollama: ['gemma2:9b', 'gemma2:2b', 'gemma2:27b', 'codellama', 'llama3.2', 'qwen2.5-coder'],
  custom: ['default-local-model', 'custom-endpoint-model'],
};

export function maskApiKey(key?: string): string {
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim().length === 0) return '';
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function isLocalEndpoint(endpoint?: string): boolean {
  if (!endpoint) return false;
  const validation = validateEndpointUrl(endpoint, { allowLocalTrusted: true });
  return validation.isValid && validation.isLocal;
}

/**
 * Custom OpenAI-compatible endpoints may be local or remote. Any custom endpoint
 * that is not an explicitly trusted loopback URL must require cloud-transmission consent.
 */
export function requiresCloudConsent(provider: ProviderType, endpoint?: string): boolean {
  if (provider === 'ollama') return false;
  if (provider === 'custom') {
    return !isLocalEndpoint(endpoint || 'http://127.0.0.1:8000/v1');
  }
  return ['gemini', 'gemma', 'openai', 'anthropic'].includes(provider);
}

export const ALLOWED_PROVIDERS = new Set<string>(['gemini', 'gemma', 'openai', 'anthropic', 'ollama', 'custom']);

async function fetchResponseText(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxResponseBytes: number
): Promise<{ response: Response; bodyText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: 'error' });
    const bodyText = await readResponseTextLimited(response, maxResponseBytes);
    return { response, bodyText };
  } finally {
    clearTimeout(timer);
  }
}

async function requestGoogleGenerateContent(
  apiKey: string,
  model: string,
  contents: string,
  systemInstruction: string | undefined,
  timeoutMs: number,
  maxResponseBytes: number,
  maxOutputTokens = 2048,
  temperature = 0.1,
): Promise<any> {
  const requestBody: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: contents }] }],
    generationConfig: { maxOutputTokens, temperature },
  };
  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const { response, bodyText } = await fetchPinnedHttpsResponseText(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
    redirect: 'error',
  }, timeoutMs, maxResponseBytes);

  if (!response.ok) {
    const errorData: any = parseProviderJson(bodyText || '{}');
    throw new Error(sanitizeErrorMessage(errorData?.error?.message || `Google API returned HTTP ${response.status}`));
  }
  return parseProviderJson(bodyText);
}

function extractGoogleResponseText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('');
}

export function isValidProvider(provider: unknown): provider is ProviderType {
  return typeof provider === 'string' && ALLOWED_PROVIDERS.has(provider) && Object.hasOwn(state.providers, provider);
}

// Preserve prior provider and model when offline mode is toggled on/off
let previousOnlineProvider: ProviderType = 'gemini';
let previousOnlineModel: string = 'gemini-3.8-flash';

export function getProviderState(): ProviderState {
  return state;
}

export function setCloudConsent(granted: boolean): boolean {
  state.cloudConsentGranted = !!granted;
  return state.cloudConsentGranted;
}

export function setOfflineMode(enabled: boolean): boolean {
  if (enabled && !state.offlineMode) {
    // Stash active online provider and model before forcing offline
    previousOnlineProvider = state.activeProvider;
    previousOnlineModel = state.activeModel;
    state.offlineMode = true;
    state.activeProvider = 'ollama';
    state.activeModel = state.providers.ollama.selectedModel;
  } else if (!enabled && state.offlineMode) {
    // Restore prior online provider and model cleanly
    state.offlineMode = false;
    state.activeProvider = previousOnlineProvider;
    state.activeModel = previousOnlineModel;
  }
  return state.offlineMode;
}

export function setActiveProvider(provider: string, model?: string) {
  if (!isValidProvider(provider)) {
    throw new Error(`Invalid provider identifier "${String(provider)}". Must be one of: ${Array.from(ALLOWED_PROVIDERS).join(', ')}`);
  }

  if (state.offlineMode && provider !== 'ollama') {
    throw new Error('Offline mode is active. Cannot switch to external cloud provider. Disable offline mode first.');
  }

  const normalizedModel = normalizeModelName(model);
  state.activeProvider = provider;
  if (normalizedModel) {
    state.activeModel = normalizedModel;
    state.providers[provider].selectedModel = normalizedModel;
  } else {
    state.activeModel = state.providers[provider].selectedModel;
  }
}

export function updateProviderConfig(
  provider: string,
  config: { selectedModel?: string; apiKey?: string; endpoint?: string }
) {
  if (!isValidProvider(provider)) {
    throw new Error(`Invalid provider identifier "${String(provider)}". Must be one of: ${Array.from(ALLOWED_PROVIDERS).join(', ')}`);
  }

  // Treat provider settings as untrusted API input, even when called outside Express.
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Provider configuration must be a plain object.');
  }
  const prototype = Object.getPrototypeOf(config);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('Provider configuration must not contain an unexpected prototype.');
  }
  const allowedConfigKeys = new Set(['selectedModel', 'apiKey', 'endpoint']);
  for (const key of Object.keys(config)) {
    if (!allowedConfigKeys.has(key)) throw new Error(`Unsupported provider configuration field: ${key}`);
  }
  const normalizedSelectedModel = normalizeModelName(config.selectedModel);
  if (config.apiKey !== undefined && (typeof config.apiKey !== 'string' || config.apiKey.length > 4096 || /[\r\n\u0000]/.test(config.apiKey))) {
    throw new Error('API key must be a string of at most 4096 characters without line breaks.');
  }
  if (config.endpoint !== undefined && (typeof config.endpoint !== 'string' || config.endpoint.length > 2048 || /[\u0000-\u001f\u007f]/.test(config.endpoint))) {
    throw new Error('Endpoint must be a valid string of at most 2048 characters without control characters.');
  }

  const current = state.providers[provider];

  if (config.endpoint !== undefined && typeof config.endpoint === 'string' && config.endpoint.trim().length > 0) {
    const isOllama = provider === 'ollama';
    const isCustomLocal = provider === 'custom' && isLocalEndpoint(config.endpoint);
    const allowTrustedLoopback = isOllama || isCustomLocal;
    const validation = validateEndpointUrl(config.endpoint, {
      allowLocalTrusted: allowTrustedLoopback,
      requiresHttps: !allowTrustedLoopback,
      allowedLocalPorts: isOllama
        ? [11434, 8000, 8080]
        : isCustomLocal ? [8000, 8080, 11434, 5000] : undefined
    });

    if (!validation.isValid) {
      throw new Error(`Invalid endpoint for ${provider}: ${validation.error}`);
    }
    current.endpoint = validation.sanitizedUrl;
  }

  if (normalizedSelectedModel) {
    current.selectedModel = normalizedSelectedModel;
  }

  if (config.apiKey !== undefined && typeof config.apiKey === 'string') {
    const cleaned = config.apiKey.trim();
    if (cleaned.length > 0) {
      current.apiKey = cleaned;
      current.isConfigured = true;
    } else {
      current.apiKey = '';
      current.isConfigured = provider === 'ollama';
    }
  }

  if (provider === state.activeProvider && normalizedSelectedModel) {
    state.activeModel = normalizedSelectedModel;
  }
}

export function removeProviderConfig(provider: string) {
  if (!isValidProvider(provider)) {
    throw new Error(`Invalid provider identifier "${String(provider)}"`);
  }
  state.providers[provider].apiKey = '';
  state.providers[provider].isConfigured = provider === 'ollama';
}

export function getPublicProviderConfigs(): ProviderConfig[] {
  const providers: ProviderType[] = ['gemini', 'gemma', 'ollama', 'openai', 'anthropic', 'custom'];
  return providers.map(p => {
    const cfg = state.providers[p];
    return {
      id: p,
      name: getProviderDisplayName(p),
      description: getProviderDescription(p),
      models: DEFAULT_MODELS[p],
      selectedModel: cfg.selectedModel,
      apiKey: maskApiKey(cfg.apiKey),
      hasKeyStored: !!(cfg.apiKey && cfg.apiKey.length > 0),
      endpoint: cfg.endpoint,
      isConfigured: cfg.isConfigured,
      isActive: state.activeProvider === p,
      requiresKey: p !== 'ollama',
      supportsLocal: p === 'ollama' || p === 'custom',
    };
  });
}

function getProviderDisplayName(p: ProviderType): string {
  switch (p) {
    case 'gemini': return 'Google Gemini';
    case 'gemma': return 'Google Gemma';
    case 'ollama': return 'Ollama (Local Engine)';
    case 'openai': return 'OpenAI';
    case 'anthropic': return 'Anthropic Claude';
    case 'custom': return 'Custom OpenAI-Compatible';
  }
}

function getProviderDescription(p: ProviderType): string {
  switch (p) {
    case 'gemini': return 'Google Gemini multimodal developer API with fast inference and deep security reasoning.';
    case 'gemma': return 'Open model family built from Google research. Supports hosted API and local execution.';
    case 'ollama': return 'Local inference runner for running Gemma, Llama, and CodeLlama with zero cloud transmission.';
    case 'openai': return 'OpenAI GPT-4o and mini models via standard OpenAI API endpoint.';
    case 'anthropic': return 'Anthropic Claude 3.5 Sonnet and Haiku models via Messages API.';
    case 'custom': return 'Self-hosted or alternative OpenAI-compatible endpoints (vLLM, LocalAI, LM Studio).';
  }
}

/**
 * Connects to local Ollama instance with SSRF and timeout guards.
 */
export async function queryOllama(endpoint: string = 'http://127.0.0.1:11434'): Promise<{
  available: boolean;
  installedModels: string[];
  gemmaModels: string[];
  error?: string;
}> {
  const validation = validateEndpointUrl(endpoint, {
    allowLocalTrusted: true,
    allowedLocalPorts: [11434, 8000, 8080]
  });

  if (!validation.isValid) {
    return {
      available: false,
      installedModels: [],
      gemmaModels: [],
      error: validation.error || 'Invalid Ollama endpoint'
    };
  }

  const cleanEndpoint = validation.sanitizedUrl || 'http://127.0.0.1:11434';
  try {
    const { response: res, bodyText } = await fetchResponseText(
      `${cleanEndpoint}/api/tags`, { method: 'GET' }, 2000, 1024 * 1024
    );

    if (!res.ok) {
      return {
        available: false,
        installedModels: [],
        gemmaModels: [],
        error: `Ollama returned HTTP ${res.status}`,
      };
    }

    const data: any = parseProviderJson(bodyText);
    const models: string[] = Array.isArray(data.models)
      ? data.models.map((m: any) => m.name || m.model).filter(Boolean)
      : [];

    const gemmaModels = models.filter(m => /gemma/i.test(m));

    return {
      available: true,
      installedModels: models,
      gemmaModels,
    };
  } catch (err: any) {
    return {
      available: false,
      installedModels: [],
      gemmaModels: [],
      error: sanitizeErrorMessage(err.name === 'AbortError' ? 'Connection timed out after 2000ms' : (err.message || 'Ollama offline')),
    };
  }
}

/**
 * Tests connection to a specific provider with SSRF and credential validation.
 */
export async function testProviderConnection(params: {
  provider: ProviderType;
  model: string;
  apiKey?: string;
  endpoint?: string;
}): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const { provider, model, apiKey, endpoint } = params;
  const startTime = Date.now();

  try {
    if (!isValidProvider(provider)) {
      throw new Error('Unsupported provider identifier.');
    }

    // Connection tests are outbound provider requests too. Apply the same
    // offline and consent policy as analysis before sending a ping or API key.
    if (state.offlineMode && provider !== 'ollama') {
      throw new Error('Offline mode is active. External provider connection tests are blocked.');
    }
    const configuredEndpoint = endpoint || state.providers[provider].endpoint;
    if (requiresCloudConsent(provider, configuredEndpoint) && !state.cloudConsentGranted) {
      throw new Error('Cloud AI transmission requires explicit consent before testing a remote provider connection.');
    }

    // 1. OLLAMA
    if (provider === 'ollama') {
      const ep = endpoint || state.providers.ollama.endpoint || 'http://127.0.0.1:11434';
      const ollamaRes = await queryOllama(ep);
      if (!ollamaRes.available) {
        throw new Error(ollamaRes.error || `Unable to reach Ollama at ${ep}`);
      }

      if (ollamaRes.installedModels.length === 0) {
        return {
          success: true,
          latencyMs: Date.now() - startTime,
          message: `Connected to Ollama at ${ep}, but no models are currently installed. Run 'ollama pull ${model}' in your terminal.`,
        };
      }

      const hasModel = ollamaRes.installedModels.some(m => m.toLowerCase().startsWith(model.toLowerCase()));
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        message: hasModel
          ? `Connected to Ollama. Model "${model}" is installed and verified.`
          : `Connected to Ollama. Installed models: ${ollamaRes.installedModels.join(', ')}. Target model "${model}" can be pulled locally.`,
      };
    }

    // 2. GEMINI or Hosted GEMMA
    if (provider === 'gemini' || provider === 'gemma') {
      if (state.offlineMode) {
        throw new Error('Offline mode is active. Cannot connect to Google cloud endpoints.');
      }

      const keyToUse = apiKey || state.providers[provider].apiKey || process.env.GEMINI_API_KEY;
      if (!keyToUse || keyToUse === 'MY_GEMINI_API_KEY' || keyToUse.trim().length === 0) {
        throw new Error('API key is not configured for Google Gemini/Gemma API.');
      }

      const targetModel = model || (provider === 'gemma' ? 'gemma-2-9b-it' : 'gemini-3.8-flash');
      const testRes = await requestGoogleGenerateContent(
        keyToUse,
        targetModel,
        'Ping: reply with one word "OK"',
        undefined,
        6000,
        64 * 1024,
        10,
        0,
      );

      const reply = extractGoogleResponseText(testRes);
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        message: `Successfully connected to ${provider.toUpperCase()} (${targetModel}). Response: "${reply.trim().slice(0, 20)}"`,
      };
    }

    // 3. OPENAI or CUSTOM OPENAI-COMPATIBLE
    if (provider === 'openai' || provider === 'custom') {
      if (state.offlineMode && provider === 'openai') {
        throw new Error('Offline mode is active. Cannot connect to OpenAI cloud endpoints.');
      }

      const ep = endpoint || (provider === 'openai' ? 'https://api.openai.com/v1' : 'http://127.0.0.1:8000/v1');
      const isCustomLocal = provider === 'custom' && isLocalEndpoint(ep);

      const validation = validateEndpointUrl(ep, {
        allowLocalTrusted: isCustomLocal,
        requiresHttps: !isCustomLocal,
        allowedLocalPorts: isCustomLocal ? [8000, 8080, 11434, 5000] : undefined
      });

      if (!validation.isValid) {
        throw new Error(`SSRF Guard: ${validation.error}`);
      }

      const cleanEndpoint = validation.sanitizedUrl || ep;
      const keyToUse = apiKey || state.providers[provider].apiKey || '';

      if (provider === 'openai' && !keyToUse) {
        throw new Error('OpenAI API key is required to test connection.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (keyToUse) {
        headers['Authorization'] = `Bearer ${keyToUse}`;
      }

      const requestUrl = `${cleanEndpoint}/models`;
      // Every remote HTTPS endpoint is DNS-pinned, including configurable OpenAI URLs.
      // Only explicitly trusted custom loopback endpoints may use ordinary fetch.
      const request = provider === 'custom' && isCustomLocal
        ? fetchResponseText(requestUrl, { method: 'GET', headers }, 6000, 64 * 1024)
        : fetchPinnedHttpsResponseText(requestUrl, { method: 'GET', headers, redirect: 'error' }, 6000, 64 * 1024);
      const { response: res, bodyText } = await request;

      if (!res.ok) {
        throw new Error(`Endpoint returned HTTP ${res.status}: ${sanitizeErrorMessage(bodyText.slice(0, 120))}`);
      }

      return {
        success: true,
        latencyMs: Date.now() - startTime,
        message: `Successfully verified connection to ${cleanEndpoint}. Endpoint is responsive.`,
      };
    }

    // 4. ANTHROPIC
    if (provider === 'anthropic') {
      if (state.offlineMode) {
        throw new Error('Offline mode is active. Cannot connect to Anthropic cloud endpoints.');
      }

      const keyToUse = apiKey || state.providers.anthropic.apiKey || '';
      if (!keyToUse) {
        throw new Error('Anthropic API key is required to test connection.');
      }

      const { response: res, bodyText } = await fetchPinnedHttpsResponseText(
        'https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': keyToUse,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model || 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Ping' }],
          })
        }, 6000, 64 * 1024
      );

      if (!res.ok) {
        const errJson: any = parseProviderJson(bodyText || '{}');
        throw new Error(sanitizeErrorMessage(errJson?.error?.message || `Anthropic returned HTTP ${res.status}`));
      }

      return {
        success: true,
        latencyMs: Date.now() - startTime,
        message: `Successfully connected to Anthropic API (${model}).`,
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      message: sanitizeErrorMessage(err.message || 'Connection test failed'),
    };
  }
}

/**
 * Dispatches code analysis request to the active provider with strict security boundaries.
 */
export async function generateAnalysisWithActiveProvider(
  prompt: string,
  sourceFiles?: readonly UntrustedSourceFile[],
): Promise<string> {
  // Both the review request and uploaded source are untrusted input. The request is
  // never promoted into the provider's trusted system instruction, regardless of caller.
  const { activeProvider, activeModel, offlineMode, cloudConsentGranted } = state;
  const cfg = state.providers[activeProvider];
  const prepared = prepareProviderReviewPayload(activeProvider, cfg.endpoint, prompt, sourceFiles);
  const needsCloudConsent = prepared.needsCloudConsent;
  const systemInstruction = prepared.systemInstruction;
  const userPayload = prepared.userPayload;

  // 1. STRICT OFFLINE POLICY CHECK
  if (offlineMode) {
    if (activeProvider !== 'ollama') {
      throw new Error(
        `Offline mode is active. External API calls to ${activeProvider} are strictly blocked. Switch to local Ollama or run in-memory analysis.`
      );
    }

    const validation = validateEndpointUrl(cfg.endpoint || 'http://127.0.0.1:11434', {
      allowLocalTrusted: true,
      allowedLocalPorts: [11434, 8000, 8080]
    });

    if (!validation.isValid || !validation.isLocal) {
      throw new Error(
        `Offline mode is active. Ollama endpoint "${cfg.endpoint}" is invalid or not a trusted loopback address.`
      );
    }
  }

  // 2. EXPLICIT CLOUD CONSENT CHECK (includes remote custom endpoints)
  if (needsCloudConsent && !cloudConsentGranted) {
    throw new Error(
      `Cloud AI transmission requires explicit user consent before uploading source code to ${activeProvider.toUpperCase()}. Run local in-memory analysis or grant cloud AI consent in Settings.`
    );
  }

  // A. OLLAMA (Local)
  if (activeProvider === 'ollama') {
    const epValidation = validateEndpointUrl(cfg.endpoint || 'http://127.0.0.1:11434', {
      allowLocalTrusted: true,
      allowedLocalPorts: [11434, 8000, 8080]
    });

    if (!epValidation.isValid) {
      throw new Error(`Ollama SSRF Guard: ${epValidation.error}`);
    }

    const ep = epValidation.sanitizedUrl || 'http://127.0.0.1:11434';
    const { response: res, bodyText } = await fetchResponseText(
      `${ep}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeModel || 'gemma2:9b',
          system: systemInstruction,
          prompt: userPayload,
          stream: false,
          options: { temperature: 0.1, num_predict: 2048 }
        })
      }, 20000, 2 * 1024 * 1024
    );

    if (!res.ok) {
      throw new Error(`Ollama request failed with HTTP ${res.status}`);
    }

    const data: any = parseProviderJson(bodyText);
    return typeof data.response === 'string' ? data.response : '';
  }

  // B. GEMINI or HOSTED GEMMA
  if (activeProvider === 'gemini' || activeProvider === 'gemma') {
    const keyToUse = cfg.apiKey || process.env.GEMINI_API_KEY;
    if (!keyToUse || keyToUse === 'MY_GEMINI_API_KEY' || keyToUse.trim().length === 0) {
      throw new Error(`Google API key not configured for ${activeProvider}.`);
    }

    const response = await requestGoogleGenerateContent(
      keyToUse,
      activeModel || (activeProvider === 'gemma' ? 'gemma-2-9b-it' : 'gemini-3.8-flash'),
      userPayload,
      systemInstruction,
      18000,
      2 * 1024 * 1024,
    );

    return extractGoogleResponseText(response);
  }

  // C. OPENAI or CUSTOM OPENAI-COMPATIBLE
  if (activeProvider === 'openai' || activeProvider === 'custom') {
    const ep = cfg.endpoint || (activeProvider === 'openai' ? 'https://api.openai.com/v1' : 'http://127.0.0.1:8000/v1');
    const isCustomLocal = activeProvider === 'custom' && isLocalEndpoint(ep);

    const validation = validateEndpointUrl(ep, {
      allowLocalTrusted: isCustomLocal,
      requiresHttps: !isCustomLocal,
      allowedLocalPorts: isCustomLocal ? [8000, 8080, 11434, 5000] : undefined
    });

    if (!validation.isValid) {
      throw new Error(`SSRF Guard: ${validation.error}`);
    }

    const cleanEndpoint = validation.sanitizedUrl || ep;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

    const requestUrl = `${cleanEndpoint}/chat/completions`;
    const requestInit: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPayload },
        ],
        temperature: 0.1,
        max_tokens: 2048
      }),
      redirect: 'error',
    };
    // Remote OpenAI and custom HTTPS endpoints must use DNS-pinned transport.
    // Ordinary fetch is reserved for explicitly trusted custom loopback endpoints.
    const request = activeProvider === 'custom' && isCustomLocal
      ? fetchResponseText(requestUrl, requestInit, 18000, 2 * 1024 * 1024)
      : fetchPinnedHttpsResponseText(requestUrl, requestInit, 18000, 2 * 1024 * 1024);
    const { response: res, bodyText } = await request;

    if (!res.ok) {
      throw new Error(`${activeProvider} API error (${res.status}): ${sanitizeErrorMessage(bodyText.slice(0, 100))}`);
    }

    const data: any = parseProviderJson(bodyText);
    return typeof data.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content : '';
  }

  // D. ANTHROPIC
  if (activeProvider === 'anthropic') {
    if (!cfg.apiKey) throw new Error('Anthropic API key required.');
    const { response: res, bodyText } = await fetchPinnedHttpsResponseText(
      'https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: activeModel || 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          system: systemInstruction,
          messages: [{ role: 'user', content: userPayload }]
        })
      }, 18000, 2 * 1024 * 1024
    );

    if (!res.ok) {
      const errJson: any = parseProviderJson(bodyText || '{}');
      throw new Error(sanitizeErrorMessage(errJson?.error?.message || `Anthropic HTTP ${res.status}`));
    }

    const data: any = parseProviderJson(bodyText);
    return typeof data.content?.[0]?.text === 'string' ? data.content[0].text : '';
  }

  throw new Error(`Unsupported provider: ${activeProvider}`);
}

export function extractJsonFromModelResponse(text: string): any {
  if (!text || text.trim().length === 0) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try matching ```json ... ``` code fence
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (e2) {}
    }

    // Try finding outermost JSON object
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch (e3) {}
    }
  }
  return {};
}
