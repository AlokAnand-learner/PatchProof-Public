/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { analyzeSourceCodeContextAware } from './src/engine/contextAnalyzer.ts';
import { runEvaluationSuite } from './src/data/evaluationSuite.ts';
import { validateFix } from './src/engine/fixValidator.ts';
import { validateAIModelFindings } from './src/engine/aiFindingValidation.ts';
import { runFixValidationSuite } from './src/data/fixValidationSuite.ts';
import { VulnerabilityFinding, SecurityMetrics } from './src/types/security.ts';
import {
  getProviderState,
  requiresCloudConsent,
  isLocalEndpoint,
  setOfflineMode,
  setCloudConsent,
  setActiveProvider,
  updateProviderConfig,
  removeProviderConfig,
  getPublicProviderConfigs,
  queryOllama,
  testProviderConnection,
  generateAnalysisWithActiveProvider,
  extractJsonFromModelResponse,
} from './src/engine/providerEngine.ts';
import { sanitizeErrorMessage } from './src/utils/ssrfValidator.ts';
import { detectLanguage, isSupportedSourceFile, sanitizeRelativePath, sanitizeSingleFileName } from './src/utils/archiveUtils.ts';
import { classifyRequestBodyError } from './src/utils/requestError.ts';
import { isAllowedLocalHostHeader, isAllowedLocalOrigin } from './src/utils/localHostPolicy.ts';
import { loadRuntimeConfig } from './src/utils/runtimeConfig.ts';
import { getContentSecurityPolicy } from './src/utils/securityHeaders.ts';
import { countSourceLinesWithinLimit, MAX_SOURCE_LINES_PER_FILE, MAX_SOURCE_LINES_PER_PROJECT } from './src/utils/sourceLimits.ts';
import { buildAiCoverageNotice, countFindingOrigins } from './src/engine/analysisCoverage.ts';
import { createConcurrencyGate } from './src/utils/concurrencyGate.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Single-user local deployment security token generated on server startup
const SERVER_SESSION_TOKEN = crypto.randomBytes(32).toString('hex');

// Local-only mode: validate listener configuration before creating the server.
// LAN/public exposure requires a separate, explicitly approved deployment phase.
const { host: HOST, port: PORT } = loadRuntimeConfig(process.env);

// In-memory rate limiting with bounded memory pruning (max 120 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_RATE_LIMIT_ENTRIES = 10_000;
const MAX_AI_FILES_PER_PROJECT = 10;

// Bound expensive provider/analysis work independently from the per-IP rate limit.
const providerTaskGate = createConcurrencyGate(2);
function limitProviderTasks(_req: Request, res: Response, next: NextFunction) {
  const release = providerTaskGate.tryAcquire();
  if (!release) {
    return res.status(429).json({ error: 'PatchProof is already processing the maximum number of provider or analysis tasks. Please retry shortly.' });
  }
  let released = false;
  const releaseOnce = () => {
    if (released) return;
    released = true;
    release();
  };
  res.once('finish', releaseOnce);
  res.once('close', releaseOnce);
  next();
}

// Prune expired rate limit entries every 2 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 2 * 60 * 1000).unref();

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // Skip rate limiting for static asset requests (css, js, images, favicon)
  const pathLower = req.path.toLowerCase();
  if (
    pathLower.startsWith('/assets/') ||
    pathLower.endsWith('.js') ||
    pathLower.endsWith('.css') ||
    pathLower.endsWith('.svg') ||
    pathLower.endsWith('.ico') ||
    pathLower.endsWith('.png') ||
    pathLower.endsWith('.woff2')
  ) {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 120;

  const current = rateLimitMap.get(ip);
  if (!current || now > current.resetTime) {
    // Bound memory even when many distinct source addresses hit the server inside one window.
    if (!current && rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
      for (const [key, entry] of rateLimitMap) {
        if (now > entry.resetTime) rateLimitMap.delete(key);
      }
      if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
        const oldestKey = rateLimitMap.keys().next().value;
        if (oldestKey !== undefined) rateLimitMap.delete(oldestKey);
      }
    }
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (current.count >= maxRequests) {
    return res.status(429).json({ error: 'Rate limit exceeded: Too many requests. Please slow down.' });
  }

  current.count++;
  next();
}

/**
 * Strict Host header validation to prevent DNS rebinding attacks on single-user local instances.
 * Rejects every non-loopback Host header; no LAN or hosted preview exceptions exist in this phase.
 */
function validateHostHeader(req: Request, res: Response, next: NextFunction) {
  if (!isAllowedLocalHostHeader(req.headers.host)) {
    return res.status(403).json({
      error: 'Forbidden: PatchProof is configured for localhost access only.',
      deploymentBoundary: 'single-user-local'
    });
  }
  next();
}

/**
 * Origin & Cross-Site Request Validation Middleware.
 * Protects session token delivery and sensitive endpoints from cross-origin theft and CSRF.
 * Permitted origins: strictly localhost, 127.0.0.1, and ::1.
 * Missing Origin is preserved to support legitimate local CLI / curl and same-origin GET workflows.
 */
function validateOriginAndCrossSite(req: Request, res: Response, next: NextFunction) {
  const originHeader = req.headers.origin;

  // 1. Inspect cross-site fetch metadata on API endpoints to prevent cross-site token exfiltration
  if (req.path.startsWith('/api/')) {
    const secFetchSite = (req.headers['sec-fetch-site'] as string || '').toLowerCase();
    if (secFetchSite === 'cross-site' && !originHeader) {
      return res.status(403).json({
        error: 'Forbidden: Cross-site requests are rejected by local security boundary.',
        deploymentBoundary: 'single-user-local'
      });
    }
  }

  // 2. Validate Origin header when present
  if (originHeader) {
    if (typeof originHeader !== 'string' || originHeader.trim().length === 0) {
      return res.status(403).json({ error: 'Forbidden: Malformed Origin header.' });
    }

    if (!isAllowedLocalOrigin(originHeader)) {
      return res.status(403).json({
        error: 'Forbidden: Only localhost origins are permitted by the local-only security boundary.',
        deploymentBoundary: 'single-user-local'
      });
    }

    if (req.path.startsWith('/api/') && (req.headers['sec-fetch-site'] as string || '').toLowerCase() === 'cross-site') {
      return res.status(403).json({
        error: 'Forbidden: Cross-site requests are rejected by the local-only security boundary.',
        deploymentBoundary: 'single-user-local'
      });
    }
  }

  next();
}

/**
 * Standard security headers middleware (CSP, nosniff, framing, referrer).
 * Local-only policy: third-party embedding is not supported.
 */
function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader(
    'Content-Security-Policy',
    getContentSecurityPolicy(process.env.NODE_ENV === 'development')
  );
  next();
}

/**
 * Access Control Middleware for Sensitive Server Configuration Mutations.
 * Enforces single-user session token boundary with constant-time crypto comparison.
 */
function requireSessionAuth(req: Request, res: Response, next: NextFunction) {
  const authToken = (req.headers['x-patchproof-auth'] as string) ||
    (req.headers['authorization']?.replace(/^Bearer\s+/i, '') as string);

  if (!authToken || typeof authToken !== 'string') {
    return res.status(401).json({
      error: 'Unauthorized: Session authentication required to modify provider settings or system status.',
      deploymentBoundary: 'single-user-local'
    });
  }

  const tokenBuffer = Buffer.from(authToken, 'utf8');
  const serverTokenBuffer = Buffer.from(SERVER_SESSION_TOKEN, 'utf8');

  // Constant-time cryptographic comparison preventing timing attacks
  if (tokenBuffer.length !== serverTokenBuffer.length || !crypto.timingSafeEqual(tokenBuffer, serverTokenBuffer)) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid session authentication token.',
      deploymentBoundary: 'single-user-local'
    });
  }

  next();
}

/**
 * Reject unauthenticated API requests before parsing potentially large JSON bodies.
 * The allowlist contains only intentionally public, read-only local endpoints and
 * the one-time local session bootstrap endpoint. Route-level guards remain in place.
 */
function preBodyAuthGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/')) return next();
  if (req.method === 'OPTIONS') return next();

  const publicGetPaths = new Set([
    '/api/auth/session',
    '/api/status',
    '/api/providers',
    '/api/config',
    '/api/evaluate',
    '/api/fix/benchmark'
  ]);
  if ((req.method === 'GET' || req.method === 'HEAD') && publicGetPaths.has(req.path)) {
    return next();
  }

  return requireSessionAuth(req, res, next);
}

async function startServer() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(validateHostHeader);
  app.use(validateOriginAndCrossSite);
  app.use(securityHeaders);
  // Enforce request limits and authentication before parsing attacker-controlled JSON.
  app.use(rateLimiter);
  app.use(preBodyAuthGuard);
  app.use(express.json({ limit: '25mb' }));

  // Session Token Bootstrap Endpoint for the local client
  app.get('/api/auth/session', (_req: Request, res: Response) => {
    res.json({
      sessionToken: SERVER_SESSION_TOKEN,
      deploymentBoundary: 'single-user-local',
      authenticated: true
    });
  });

  // Status & Health Endpoint
  app.get('/api/status', limitProviderTasks, async (_req: Request, res: Response) => {
    const provState = getProviderState();
    const ollamaStatus = await queryOllama(provState.providers.ollama.endpoint);
    res.json({
      status: 'operational',
      offlineMode: provState.offlineMode,
      cloudConsentGranted: provState.cloudConsentGranted,
      deploymentBoundary: 'single-user-local',
      activeProvider: provState.activeProvider,
      activeModel: provState.activeModel,
      activeProviderEndpoint: provState.providers[provState.activeProvider]?.endpoint || null,
      hasApiKey: !!(provState.providers[provState.activeProvider]?.apiKey || provState.activeProvider === 'ollama'),
      engine: provState.offlineMode
        ? `Offline Mode (${provState.activeProvider}: ${provState.activeModel})`
        : `${provState.activeProvider.toUpperCase()} (${provState.activeModel}) + Context-Aware Pipeline`,
      serviceName: 'PatchProof Security Auditor',
      ollama: ollamaStatus
    });
  });

  // Toggle Offline Mode (Protected mutation)
  app.post('/api/status/offline-mode', requireSessionAuth, (req: Request, res: Response) => {
    const { enabled, offlineMode } = req.body;
    const targetState = enabled !== undefined ? !!enabled : (offlineMode !== undefined ? !!offlineMode : false);
    const isOffline = setOfflineMode(targetState);
    res.json({
      offlineMode: isOffline,
      activeProvider: getProviderState().activeProvider,
      activeModel: getProviderState().activeModel
    });
  });

  // Toggle Cloud Consent (Protected mutation)
  app.post('/api/status/cloud-consent', requireSessionAuth, (req: Request, res: Response) => {
    const { granted } = req.body;
    if (typeof granted !== 'boolean') {
      return res.status(400).json({ error: 'Cloud consent must be an explicit boolean value.' });
    }
    const isGranted = setCloudConsent(granted);
    res.json({
      cloudConsentGranted: isGranted,
      message: isGranted
        ? 'Cloud AI analysis consent granted. Source code may be transmitted to configured cloud models with explicit disclosure.'
        : 'Cloud AI consent revoked. Analysis is restricted to in-memory local AST or local Ollama engine.'
    });
  });

  // Providers List
  app.get('/api/providers', (_req: Request, res: Response) => {
    res.json({
      providers: getPublicProviderConfigs(),
      activeProvider: getProviderState().activeProvider,
      activeModel: getProviderState().activeModel,
      offlineMode: getProviderState().offlineMode,
      cloudConsentGranted: getProviderState().cloudConsentGranted
    });
  });

  // Set Active Provider / Model (Protected mutation)
  app.post('/api/provider/activate', requireSessionAuth, (req: Request, res: Response) => {
    const { provider, model } = req.body;
    if (!provider) return res.status(400).json({ error: 'Provider is required' });
    try {
      setActiveProvider(provider, model);
      res.json({
        success: true,
        activeProvider: provider,
        activeModel: getProviderState().activeModel
      });
    } catch (err: any) {
      res.status(400).json({ error: sanitizeErrorMessage(err.message || 'Cannot activate provider') });
    }
  });

  // Save / Update Provider Configuration (Protected mutation with SSRF validation)
  app.post('/api/provider/config', requireSessionAuth, (req: Request, res: Response) => {
    const { provider, selectedModel, apiKey, endpoint } = req.body;
    if (!provider) return res.status(400).json({ error: 'Provider is required' });
    try {
      updateProviderConfig(provider, { selectedModel, apiKey, endpoint });
      res.json({
        success: true,
        providers: getPublicProviderConfigs(),
        activeProvider: getProviderState().activeProvider,
        activeModel: getProviderState().activeModel
      });
    } catch (err: any) {
      res.status(400).json({ error: sanitizeErrorMessage(err.message || 'Failed to update provider configuration') });
    }
  });

  // Remove Provider Configuration (Protected mutation)
  app.delete('/api/provider/config/:provider', requireSessionAuth, (req: Request, res: Response) => {
    const { provider } = req.params;
    removeProviderConfig(provider as any);
    res.json({
      success: true,
      providers: getPublicProviderConfigs()
    });
  });

  // Test Provider Connection (Protected mutation with SSRF and credential masking)
  app.post('/api/provider/test', requireSessionAuth, limitProviderTasks, async (req: Request, res: Response) => {
    const { provider, model, apiKey, endpoint } = req.body;
    if (!provider) return res.status(400).json({ success: false, message: 'Provider required' });
    const result = await testProviderConnection({ provider, model, apiKey, endpoint });
    res.json(result);
  });

  // --- SEC-02 Compatible Endpoint Aliases (Mutating routes protected with requireSessionAuth) ---
  app.post('/api/set-offline-mode', requireSessionAuth, (req: Request, res: Response) => {
    const { enabled, offlineMode } = req.body;
    const targetState = enabled !== undefined ? !!enabled : (offlineMode !== undefined ? !!offlineMode : false);
    const isOffline = setOfflineMode(targetState);
    res.json({
      offlineMode: isOffline,
      activeProvider: getProviderState().activeProvider,
      activeModel: getProviderState().activeModel
    });
  });

  app.post('/api/set-cloud-consent', requireSessionAuth, (req: Request, res: Response) => {
    const { granted } = req.body;
    if (typeof granted !== 'boolean') {
      return res.status(400).json({ error: 'Cloud consent must be an explicit boolean value.' });
    }
    const isGranted = setCloudConsent(granted);
    res.json({
      cloudConsentGranted: isGranted,
      message: isGranted
        ? 'Cloud AI analysis consent granted.'
        : 'Cloud AI consent revoked.'
    });
  });

  app.post('/api/set-active-provider', requireSessionAuth, (req: Request, res: Response) => {
    const { provider, model } = req.body;
    if (!provider) return res.status(400).json({ error: 'Provider is required' });
    try {
      setActiveProvider(provider, model);
      res.json({
        success: true,
        activeProvider: provider,
        activeModel: getProviderState().activeModel
      });
    } catch (err: any) {
      res.status(400).json({ error: sanitizeErrorMessage(err.message || 'Cannot activate provider') });
    }
  });

  app.get('/api/config', (_req: Request, res: Response) => {
    res.json(getPublicProviderConfigs());
  });

  app.post('/api/config', requireSessionAuth, (req: Request, res: Response) => {
    const { provider, config, selectedModel, apiKey, endpoint } = req.body;
    if (!provider) return res.status(400).json({ error: 'Provider is required' });
    try {
      const cfg = config || { selectedModel, apiKey, endpoint };
      updateProviderConfig(provider, cfg);
      res.json({
        success: true,
        providers: getPublicProviderConfigs(),
        activeProvider: getProviderState().activeProvider,
        activeModel: getProviderState().activeModel
      });
    } catch (err: any) {
      res.status(400).json({ error: sanitizeErrorMessage(err.message || 'Failed to update provider configuration') });
    }
  });

  app.delete('/api/config/:provider', requireSessionAuth, (req: Request, res: Response) => {
    const { provider } = req.params;
    removeProviderConfig(provider as any);
    res.json({
      success: true,
      providers: getPublicProviderConfigs()
    });
  });

  app.post('/api/test-connection', requireSessionAuth, limitProviderTasks, async (req: Request, res: Response) => {
    const { provider, config, model, apiKey, endpoint } = req.body;
    if (!provider) return res.status(400).json({ success: false, message: 'Provider required' });
    const cfg = config || { model, apiKey, endpoint };
    const result = await testProviderConnection({ provider, ...cfg });
    res.json(result);
  });

  app.post('/api/query', requireSessionAuth, limitProviderTasks, async (req: Request, res: Response) => {
    const { endpoint } = req.body;
    try {
      const result = await queryOllama(endpoint);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: sanitizeErrorMessage(e.message) });
    }
  });

  app.post('/api/extract-json', requireSessionAuth, (req: Request, res: Response) => {
    const { response } = req.body;
    try {
      const jsonResult = extractJsonFromModelResponse(response || '');
      res.json(jsonResult);
    } catch (e: any) {
      res.status(500).json({ error: sanitizeErrorMessage(e.message) });
    }
  });

  // Endpoint for generating analysis from provider
  app.post('/api/generate-analysis', requireSessionAuth, limitProviderTasks, async (req: Request, res: Response) => {
    const { prompt, provider } = req.body;
    try {
      if (provider) {
        try { setActiveProvider(provider); } catch {}
      }
      const analysis = await generateAnalysisWithActiveProvider(prompt || '');
      res.json(analysis);
    } catch (e: any) {
      res.status(500).json({ error: sanitizeErrorMessage(e.message) });
    }
  });

  // Query Ollama Installed Models
  app.get('/api/ollama/models', requireSessionAuth, limitProviderTasks, async (req: Request, res: Response) => {
    const endpoint = typeof req.query.endpoint === 'string' ? req.query.endpoint : undefined;
    const result = await queryOllama(endpoint);
    res.json(result);
  });

  // Evaluation Suite Runner Endpoint
  app.get('/api/evaluate', (_req: Request, res: Response) => {
    try {
      const evaluation = runEvaluationSuite();
      res.json(evaluation);
    } catch (err: any) {
      res.status(500).json({ error: 'Evaluation failed: ' + sanitizeErrorMessage(err.message) });
    }
  });

  // Fix Validation Endpoint (Live static validation of proposed security patches)
  const handleFixValidation = (req: Request, res: Response) => {
    try {
      const {
        originalSnippet,
        originalCode,
        suggestedPatch,
        fixedCode,
        surroundingContext,
        fullSourceCode,
        language,
        filePath,
        vulnerability,
        vulnerabilityCwe
      } = req.body;

      const patch = suggestedPatch || fixedCode;
      if (!patch || typeof patch !== 'string') {
        return res.status(400).json({ error: 'suggestedPatch or fixedCode string is required for validation.' });
      }

      const result = validateFix({
        originalSnippet: originalSnippet || originalCode || '',
        suggestedPatch: patch,
        surroundingContext: surroundingContext || '',
        fullSourceCode: fullSourceCode || '',
        language: language || 'javascript',
        filePath: filePath || 'file.js',
        vulnerabilityCwe: vulnerabilityCwe || (typeof vulnerability === 'string' ? vulnerability : 'CWE-Other')
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Fix validation failed: ' + sanitizeErrorMessage(err.message) });
    }
  };

  app.post('/api/fix/validate', requireSessionAuth, handleFixValidation);
  app.post('/api/validate-fix', requireSessionAuth, handleFixValidation);

  // Fix Validation Suite Benchmark Endpoint (Runs the 6-test suite)
  app.get('/api/fix/benchmark', (_req: Request, res: Response) => {
    try {
      const report = runFixValidationSuite();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: 'Fix benchmark failed: ' + sanitizeErrorMessage(err.message) });
    }
  });

  // Code Security Review Endpoint (Supports single file and multi-file projects)
  app.post('/api/analyze', requireSessionAuth, limitProviderTasks, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { code, fileName, language, projectName, files } = req.body;
      const provState = getProviderState();
      const activeEndpoint = provState.providers[provState.activeProvider]?.endpoint;

      // Consent is a server-side setting only; request JSON cannot grant itself permission.
      // Remote custom endpoints are cloud destinations too. Local custom loopback endpoints
      // may run without cloud consent, just like the local Ollama engine.
      const needsCloudConsent = requiresCloudConsent(provState.activeProvider, activeEndpoint);
      const canUseCloudAi = needsCloudConsent && !provState.offlineMode && provState.cloudConsentGranted;
      const canUseLocalConfiguredAi = provState.activeProvider === 'ollama' ||
        (provState.activeProvider === 'custom' && !needsCloudConsent && isLocalEndpoint(activeEndpoint));
      const canUseConfiguredAi = canUseCloudAi || canUseLocalConfiguredAi;

      // Case 1: Multi-file Project Submission
      if (files && Array.isArray(files) && files.length > 0) {
        if (files.length > 60) {
          return res.status(400).json({ error: 'Project exceeds maximum file count limit (60 files).' });
        }

        const safeProjectName = (projectName && typeof projectName === 'string')
          ? projectName.replace(/[^a-zA-Z0-9_\-\.\s]/g, '').trim().slice(0, 120) || 'Project Review'
          : 'Project Review';

        const allFindings: VulnerabilityFinding[] = [];
        let totalLines = 0;
        let cumulativeSize = 0;
        let modelUsed = 'Context-Aware Static Checks (Local)';
        let aiReviewAttemptedFiles = 0;
        let aiReviewCompletedFiles = 0;
        let aiReviewFailedFiles = 0;
        let aiTruncatedFiles = 0;
        let aiBudgetSkippedFiles = 0;
        const fileRecords: any[] = [];
        const skippedFiles: string[] = [];
        const seenProjectPaths = new Set<string>();

        for (const f of files) {
          if (!f || typeof f !== 'object' || Array.isArray(f)) {
            skippedFiles.push('Selected entry (Invalid file record rejected)');
            continue;
          }

          const rawPath = [f.filePath, f.path, f.name].find(value => typeof value === 'string' && value.length > 0);
          const sanitizedPath = typeof rawPath === 'string' && rawPath.length <= 500
            ? sanitizeRelativePath(rawPath)
            : null;
          if (!sanitizedPath || !isSupportedSourceFile(sanitizedPath)) {
            skippedFiles.push('Selected entry (Unsafe path or unsupported source file rejected)');
            continue;
          }
          const filePath = sanitizedPath;
          const pathKey = filePath.normalize('NFC').toLocaleLowerCase('en-US');
          if (seenProjectPaths.has(pathKey)) {
            skippedFiles.push(`${filePath} (Duplicate or case-colliding path rejected)`);
            continue;
          }
          seenProjectPaths.add(pathKey);

          if (typeof f.content !== 'string' || f.content.length === 0) {
            skippedFiles.push(`${filePath} (Missing or empty source content)`);
            continue;
          }
          const fileContent = f.content;
          // Derive language from the validated filename/content; never trust a
          // client-supplied language label inside the AI prompt.
          const fileLang = detectLanguage(filePath, fileContent);
          const fileSize = new Blob([fileContent]).size;

          // Enforce 2MB per file and 20MB cumulative limit on server
          if (fileSize > 2 * 1024 * 1024) {
            skippedFiles.push(`${filePath} (Exceeds 2MB single file limit)`);
            continue;
          }
          if (cumulativeSize + fileSize > 20 * 1024 * 1024) {
            skippedFiles.push(`${filePath} (Exceeds cumulative project limit of 20MB)`);
            continue;
          }
          if (/[\x00-\x08\x0E-\x1F]/.test(fileContent.slice(0, 1024))) {
            skippedFiles.push(`${filePath} (Binary content rejected)`);
            continue;
          }

          const sourceLineCount = countSourceLinesWithinLimit(fileContent, MAX_SOURCE_LINES_PER_FILE);
          if (sourceLineCount === null) {
            skippedFiles.push(`${filePath} (Exceeds per-file source line limit of ${MAX_SOURCE_LINES_PER_FILE})`);
            continue;
          }
          if (totalLines + sourceLineCount > MAX_SOURCE_LINES_PER_PROJECT) {
            skippedFiles.push(`${filePath} (Project source line limit of ${MAX_SOURCE_LINES_PER_PROJECT} reached)`);
            continue;
          }

          cumulativeSize += fileSize;
          const lines = fileContent.split('\n');
          totalLines += sourceLineCount;

          // 1. Run in-memory Context-Aware Static Analysis on this file
          const { findings: staticFindings } = analyzeSourceCodeContextAware(fileContent, filePath);
          let fileFindings = staticFindings;

          // 2. Run secondary reasoning only when server-side consent or a trusted local route permits it
          if (fileContent.trim().length > 15 && canUseConfiguredAi && aiReviewAttemptedFiles < MAX_AI_FILES_PER_PROJECT) {
            aiReviewAttemptedFiles += 1;
            const aiInputContent = fileContent.slice(0, 35000);
            if (aiInputContent.length < fileContent.length) aiTruncatedFiles += 1;
            try {
              const prompt = `Conduct an in-depth defensive code security review of "${filePath}" (${fileLang}).
CRITICAL RULES:
- Only report genuine or probable vulnerabilities.
- Distinguish verified flaws from hypothetical or test matches.
- Do NOT flag detection patterns, comments, regexes, or sanitized queries as vulnerabilities.
- Provide exact 1-indexed lines, explanation, attack scenario, exploit conditions, and safe suggestedPatch.
- Output strictly a JSON object with: { "findings": [{ "title": string, "cwe": string, "owaspCategory": string, "severity": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|"INFO", "confidence": "HIGH"|"MEDIUM"|"LOW", "verificationStatus": "LIKELY"|"NEEDS_REVIEW"|"FALSE_POSITIVE", "startLine": number, "endLine": number, "snippet": string, "explanation": string, "attackScenario": string, "exploitConditions": string, "remediation": string, "suggestedPatch": string }] }
`;

              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 10000)
              );

              const responseText = await Promise.race([
                generateAnalysisWithActiveProvider(prompt, [{ path: filePath, content: aiInputContent }]),
                timeoutPromise
              ]);

              const parsed = extractJsonFromModelResponse(responseText);
              if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid AI response structure');
              aiReviewCompletedFiles += 1;
              modelUsed = `${provState.activeProvider}:${provState.activeModel} (Hybrid Analysis)`;
              const safeModelFindings = validateAIModelFindings(parsed?.findings, fileContent);
              if (safeModelFindings.length > 0) {
                const aiFindings: VulnerabilityFinding[] = safeModelFindings.map((finding, fIdx) => {
                  const sLine = finding.startLine;
                  const eLine = finding.endLine;
                  const snippet = finding.snippet;
                  // AI output is never independent proof: only deterministic local analysis may confirm.
                  const statusVal = 'NEEDS_REVIEW' as const;

                  return {
                    id: `ai-finding-${fileRecords.length + 1}-${fIdx + 1}`,
                    filePath,
                    title: finding.title,
                    cwe: finding.cwe,
                    owaspCategory: finding.owaspCategory,
                    severity: finding.severity,
                    confidence: finding.confidence,
                    verificationStatus: statusVal,
                    verificationType: 'AI_HYPOTHESIS',
                    verificationMethod: 'AI_HYPOTHESIS',
                    startLine: sLine,
                    endLine: eLine,
                    snippet,
                    surroundingContext: lines.slice(Math.max(0, sLine - 3), Math.min(lines.length, eLine + 2)).join('\n'),
                    evidence: `Line ${sLine}: ${snippet}`,
                    explanation: finding.explanation,
                    attackScenario: finding.attackScenario,
                    exploitConditions: finding.exploitConditions,
                    classificationReason: 'Identified through deep contextual threat reasoning.',
                    reasoning: 'Identified via deep semantic threat reasoning model.',
                    remainingUncertainty: 'AI hypothesis: verification against complete project dependencies recommended.',
                    remediation: finding.remediation,
                    suggestedPatch: finding.suggestedPatch,
                    patchVerificationStatus: 'UNVERIFIED_REVIEW_REQUIRED',
                    status: 'OPEN',
                    dedupKey: `${filePath}:${sLine}:${finding.cwe}`,
                    analysisEngine: `${provState.activeProvider}:${provState.activeModel}`
                  };
                });

                // Merge and deduplicate
                const existingKeys = new Set(fileFindings.map(item => `${item.filePath}:${item.startLine}:${item.cwe}`));
                for (const af of aiFindings) {
                  if (!existingKeys.has(af.dedupKey || '')) {
                    fileFindings.push(af);
                  }
                }
              }
            } catch (e) {
              aiReviewFailedFiles += 1;
              // Keep the deterministic local result and disclose the AI fallback in the response.
            }
          }

          if (fileContent.trim().length > 15 && canUseConfiguredAi && aiReviewAttemptedFiles >= MAX_AI_FILES_PER_PROJECT && !fileFindings.some(item => item.verificationType === 'AI_HYPOTHESIS' && item.filePath === filePath)) {
            aiBudgetSkippedFiles += 1;
          }

          allFindings.push(...fileFindings);

          fileRecords.push({
            filePath,
            language: fileLang,
            content: fileContent,
            lines: lines.length,
            size: fileSize,
            findingsCount: fileFindings.filter(item => item.verificationStatus !== 'FALSE_POSITIVE').length
          });
        }

        // Do not report a clean scan when every submitted entry was rejected.
        if (fileRecords.length === 0) {
          return res.status(400).json({
            error: 'No valid supported source files were accepted for analysis.',
            skippedFiles: skippedFiles.slice(0, 60)
          });
        }

        // Calculate metrics
        const activeFindings = allFindings.filter(f => f.verificationStatus !== 'FALSE_POSITIVE');
        let crit = 0, high = 0, med = 0, low = 0, info = 0;
        let confirmed = 0, likely = 0, needsReview = 0, fp = allFindings.length - activeFindings.length;

        for (const f of activeFindings) {
          if (f.severity === 'CRITICAL') crit++;
          else if (f.severity === 'HIGH') high++;
          else if (f.severity === 'MEDIUM') med++;
          else if (f.severity === 'LOW') low++;
          else info++;

          if (f.verificationStatus === 'CONFIRMED') confirmed++;
          else if (f.verificationStatus === 'LIKELY') likely++;
          else needsReview++;
        }

        const penalty = crit * 25 + high * 14 + med * 7 + low * 2;
        const score = activeFindings.length === 0 ? 100 : Math.max(5, 100 - penalty);
        let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'A+';
        if (score >= 95) grade = 'A+';
        else if (score >= 85) grade = 'A';
        else if (score >= 70) grade = 'B';
        else if (score >= 50) grade = 'C';
        else if (score >= 30) grade = 'D';
        else grade = 'F';

        const metrics: SecurityMetrics = {
          score,
          grade,
          criticalCount: crit,
          highCount: high,
          mediumCount: med,
          lowCount: low,
          infoCount: info,
          totalFindings: activeFindings.length,
          confirmedCount: confirmed,
          likelyCount: likely,
          needsReviewCount: needsReview,
          falsePositiveCount: fp,
          ...countFindingOrigins(activeFindings),
          linesAnalyzed: totalLines
        };

        const executionTimeMs = Date.now() - startTime;
        const summary = activeFindings.length > 0
          ? `Identified ${activeFindings.length} security issues (${confirmed} confirmed, ${likely} likely, ${needsReview} needs review) across ${fileRecords.length} files (${totalLines} lines) in ${safeProjectName}.`
           : `No matching vulnerability patterns were identified across ${fileRecords.length} files (${totalLines} lines) in ${safeProjectName}; this does not prove the project is vulnerability-free.`;

        const validatedAllFindings = allFindings.map(f => {
          if (f.suggestedPatch && f.verificationStatus !== 'FALSE_POSITIVE') {
            const matchedFile = fileRecords.find(fr => fr.filePath === f.filePath);
            const val = validateFix({
              originalSnippet: f.snippet,
              suggestedPatch: f.suggestedPatch,
              surroundingContext: f.surroundingContext || '',
              fullSourceCode: matchedFile?.content || '',
              language: matchedFile?.language || 'javascript',
              filePath: f.filePath || 'file.js',
              vulnerabilityCwe: f.cwe
            });
            return {
              ...f,
              fixValidation: val,
              patchVerificationStatus: val.status === 'VALIDATED' ? 'VERIFIED_STATIC' : 'UNVERIFIED_REVIEW_REQUIRED'
            };
          }
          return f;
        });

        const scanResult = {
          id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          projectName: safeProjectName,
          fileName: `${safeProjectName} (${fileRecords.length} files)`,
          language: 'Multi-language Project',
          timestamp: new Date().toISOString(),
          modelUsed,
          executionTimeMs,
          originalCode: fileRecords[0]?.content || '',
          patchedFullCode: undefined,
          metrics,
          findings: validatedAllFindings,
          summary,
          recommendations: [
            'Enforce parameterized queries or ORM bindings across all data queries.',
            'Review external dependencies and ensure input boundaries are validated.',
            'Establish automated pre-commit and CI/CD security review checks.'
          ],
          isMultiFile: true,
          files: fileRecords,
          skippedFiles: skippedFiles.slice(0, 60),
          skippedCount: skippedFiles.length,
          transmissionMode: canUseCloudAi ? 'CLOUD_AI_TRANSMITTED' : 'LOCAL_ONLY',
          cloudDisclosed: canUseCloudAi,
          analysisNotice: buildAiCoverageNotice({
            attempted: aiReviewAttemptedFiles,
            completed: aiReviewCompletedFiles,
            failed: aiReviewFailedFiles,
            truncated: aiTruncatedFiles,
            maxCharactersPerFile: 35000,
            skippedByBudget: aiBudgetSkippedFiles,
            offlineMode: provState.offlineMode,
            cloudConsentRequired: requiresCloudConsent(provState.activeProvider, activeEndpoint),
            cloudConsentGranted: provState.cloudConsentGranted
          })
        };

        return res.json(scanResult);
      }

      // Case 2: Single File Submission
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Source code content or project files are required.' });
      }

      const codeByteSize = new Blob([code]).size;
      if (codeByteSize > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'Code file exceeds maximum analysis size (2MB).' });
      }

      // Check binary content
      const isBinary = /[\x00-\x08\x0E-\x1F]/.test(code.slice(0, 1024));
      if (isBinary) {
        return res.status(400).json({ error: 'Uploaded file appears to be a compiled binary. Please upload plain text source code.' });
      }

      const safeFileName = sanitizeSingleFileName(
        typeof fileName === 'string' && fileName.length > 0 ? fileName : 'source_file.txt'
      );
      if (!safeFileName) {
        return res.status(400).json({ error: 'Unsupported or invalid source filename. Use a supported plain-text source file extension.' });
      }
      const allowedLanguages = new Set([
        'javascript', 'typescript', 'python', 'go', 'java', 'php', 'cpp', 'rust',
        'csharp', 'ruby', 'sql', 'shell', 'json', 'yaml', 'html', 'css', 'plaintext'
      ]);
      const detectedLanguage = detectLanguage(safeFileName, code);
      const safeLanguage = typeof language === 'string' && allowedLanguages.has(language)
        ? language
        : detectedLanguage;
      const lineCount = countSourceLinesWithinLimit(code, MAX_SOURCE_LINES_PER_FILE);
      if (lineCount === null) {
        return res.status(400).json({ error: `Source file exceeds the ${MAX_SOURCE_LINES_PER_FILE}-line analysis limit.` });
      }
      const lines = code.split('\n');

      // 1. Run in-memory Context-Aware Analysis
      const { findings: staticFindings, metrics: staticMetrics } = analyzeSourceCodeContextAware(code, safeFileName);
      let findings = staticFindings;
      let modelUsed = 'Context-Aware Static Checks (Local)';
      let summary = '';
      let recommendations: string[] = [];
      let patchedFullCode: string | undefined; 
      let aiReviewAttempted = false;
      let aiReviewCompleted = false;
      let aiReviewFailed = false;
      let aiTruncated = false;

      // 2. Run secondary reasoning only when server-side consent or a trusted local route permits it
      if (code.trim().length > 15 && canUseConfiguredAi) {
        aiReviewAttempted = true;
        const aiInputContent = code.slice(0, 45000);
        aiTruncated = aiInputContent.length < code.length;
        try {
          const prompt = `Conduct a comprehensive code security review of "${safeFileName}" (${safeLanguage}).
CRITICAL RULES:
- Do NOT flag regexes, comments, test fixture patterns, or detection rules as vulnerabilities.
- Identify real weaknesses (Injection, XSS, Deserialization, SSRF, Path Traversal, Secrets, PRNG, Misconfig).
- Distinguish CONFIRMED vulnerabilities from LIKELY or NEEDS_REVIEW.
- Provide safe suggested patches for every identified issue.
- Output strictly a JSON object with: { "summary": string, "recommendations": string[], "patchedFullCode": string, "findings": [{ "title": string, "cwe": string, "owaspCategory": string, "severity": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|"INFO", "confidence": "HIGH"|"MEDIUM"|"LOW", "verificationStatus": "CONFIRMED"|"LIKELY"|"NEEDS_REVIEW"|"FALSE_POSITIVE", "startLine": number, "endLine": number, "snippet": string, "explanation": string, "attackScenario": string, "exploitConditions": string, "remediation": string, "suggestedPatch": string }] }
`;

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI review timeout after 12s')), 12000)
          );

          const responseText = await Promise.race([
            generateAnalysisWithActiveProvider(prompt, [{ path: safeFileName, content: aiInputContent }]),
            timeoutPromise
          ]);

          const parsed = extractJsonFromModelResponse(responseText);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid AI response structure');
          aiReviewCompleted = true;
          modelUsed = `${provState.activeProvider}:${provState.activeModel} (Hybrid Analysis)`;
          if (typeof parsed?.summary === 'string') summary = parsed.summary.slice(0, 4000);
          if (Array.isArray(parsed?.recommendations)) {
            recommendations = parsed.recommendations.filter((item: unknown): item is string => typeof item === 'string').slice(0, 30).map((item: string) => item.slice(0, 1000));
          }
          // A model-proposed full-file rewrite is not applied as authoritative output.
          // Keep the original source until a separate patch-validation workflow approves a patch.

          const safeModelFindings = validateAIModelFindings(parsed?.findings, code);
          if (safeModelFindings.length > 0) {
            const aiFindings: VulnerabilityFinding[] = safeModelFindings.map((f, idx) => {
              const sLine = f.startLine;
              const eLine = f.endLine;
              const snippet = f.snippet;
              // AI output is never independent proof: only deterministic local analysis may confirm.
              const vStatus = 'NEEDS_REVIEW' as const;

              return {
                id: `finding-ai-${idx + 1}`,
                filePath: safeFileName,
                title: f.title,
                cwe: f.cwe,
                owaspCategory: f.owaspCategory,
                severity: f.severity,
                confidence: f.confidence,
                verificationStatus: vStatus,
                verificationType: 'AI_HYPOTHESIS',
                verificationMethod: 'AI_HYPOTHESIS',
                startLine: sLine,
                endLine: eLine,
                snippet,
                surroundingContext: lines.slice(Math.max(0, sLine - 3), Math.min(lineCount, eLine + 2)).join('\n'),
                evidence: `Line ${sLine}: ${snippet}`,
                explanation: f.explanation,
                attackScenario: f.attackScenario,
                exploitConditions: f.exploitConditions,
                classificationReason: 'Identified through semantic threat reasoning.',
                reasoning: 'Identified via semantic threat reasoning model.',
                remainingUncertainty: 'AI hypothesis: verification against complete project dependencies recommended.',
                remediation: f.remediation,
                suggestedPatch: f.suggestedPatch,
                patchVerificationStatus: 'UNVERIFIED_REVIEW_REQUIRED',
                status: 'OPEN',
                dedupKey: `${safeFileName}:${sLine}:${f.cwe}`,
                analysisEngine: `${provState.activeProvider}:${provState.activeModel}`
              };
            });

            // Merge deduplicated
            const existingKeys = new Set(findings.map(item => `${item.filePath}:${item.startLine}:${item.cwe}`));
            for (const af of aiFindings) {
              if (!existingKeys.has(af.dedupKey || '')) {
                findings.push(af);
              }
            }
          }
        } catch (aiErr) {
          aiReviewFailed = true;
          console.warn('AI reasoning skipped or timed out, using in-memory context-aware engine.');
        }
      }

      // Recalculate combined metrics
      const activeFindings = findings.filter(f => f.verificationStatus !== 'FALSE_POSITIVE');
      let crit = 0, high = 0, med = 0, low = 0, info = 0;
      let confirmed = 0, likely = 0, needsReview = 0, fp = findings.length - activeFindings.length;

      for (const f of activeFindings) {
        if (f.severity === 'CRITICAL') crit++;
        else if (f.severity === 'HIGH') high++;
        else if (f.severity === 'MEDIUM') med++;
        else if (f.severity === 'LOW') low++;
        else info++;

        if (f.verificationStatus === 'CONFIRMED') confirmed++;
        else if (f.verificationStatus === 'LIKELY') likely++;
        else needsReview++;
      }

      const penalty = crit * 25 + high * 14 + med * 7 + low * 2;
      const score = activeFindings.length === 0 ? 100 : Math.max(5, 100 - penalty);
      let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'A+';
      if (score >= 95) grade = 'A+';
      else if (score >= 85) grade = 'A';
      else if (score >= 70) grade = 'B';
      else if (score >= 50) grade = 'C';
      else if (score >= 30) grade = 'D';
      else grade = 'F';

      const metrics: SecurityMetrics = {
        score,
        grade,
        criticalCount: crit,
        highCount: high,
        mediumCount: med,
        lowCount: low,
        infoCount: info,
        totalFindings: activeFindings.length,
        confirmedCount: confirmed,
        likelyCount: likely,
        needsReviewCount: needsReview,
        falsePositiveCount: fp,
        ...countFindingOrigins(activeFindings),
        linesAnalyzed: lineCount
      };

      if (!summary) {
        summary = activeFindings.length > 0
          ? `Identified ${activeFindings.length} security findings across ${lineCount} lines in ${safeFileName}.`
           : `No matching vulnerability patterns were identified across ${lineCount} lines in ${safeFileName}; this does not prove the file is vulnerability-free.`;
      }

      if (recommendations.length === 0) {
        recommendations = [
          'Enforce strict input parameterization and validation on all untrusted inputs.',
          'Review configuration files and eliminate plaintext secrets or tokens.',
          'Incorporate automated security reviews into local pre-commit hooks and pull requests.'
        ];
      }

      const executionTimeMs = Date.now() - startTime;

      const validatedFindings = findings.map(f => {
        if (f.suggestedPatch && f.verificationStatus !== 'FALSE_POSITIVE') {
          const val = validateFix({
            originalSnippet: f.snippet,
            suggestedPatch: f.suggestedPatch,
            surroundingContext: f.surroundingContext || '',
            fullSourceCode: code,
            language: safeLanguage,
            filePath: safeFileName,
            vulnerabilityCwe: f.cwe
          });
          return {
            ...f,
            fixValidation: val,
            patchVerificationStatus: val.status === 'VALIDATED' ? 'VERIFIED_STATIC' : 'UNVERIFIED_REVIEW_REQUIRED'
          };
        }
        return f;
      });

      const scanResult = {
        id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        projectName: safeFileName.replace(/\.[^/.]+$/, '') || 'Project Audit',
        fileName: safeFileName,
        language: safeLanguage,
        timestamp: new Date().toISOString(),
        modelUsed,
        executionTimeMs,
        originalCode: code,
        patchedFullCode,
        metrics,
        findings: validatedFindings,
        summary,
        recommendations,
        isMultiFile: false,
        files: [{
          filePath: safeFileName,
          language: safeLanguage,
          content: code,
          patchedContent: patchedFullCode,
          lines: lineCount,
          size: codeByteSize,
          findingsCount: activeFindings.length
        }],
        transmissionMode: canUseCloudAi ? 'CLOUD_AI_TRANSMITTED' : 'LOCAL_ONLY',
        cloudDisclosed: canUseCloudAi,
        analysisNotice: buildAiCoverageNotice({
          attempted: aiReviewAttempted ? 1 : 0,
          completed: aiReviewCompleted ? 1 : 0,
          failed: aiReviewFailed ? 1 : 0,
          truncated: aiTruncated ? 1 : 0,
          maxCharactersPerFile: 45000,
          skippedByBudget: 0,
          offlineMode: provState.offlineMode,
          cloudConsentRequired: requiresCloudConsent(provState.activeProvider, activeEndpoint),
          cloudConsentGranted: provState.cloudConsentGranted
        })
      };

      return res.json(scanResult);
    } catch (err: any) {
      console.error('Analysis error:', err);
      return res.status(500).json({
        error: 'Failed to complete code security review: ' + sanitizeErrorMessage(err.message || 'Internal server error')
      });
    }
  });

  // Sanitize JSON/body-parser failures before they reach Express's default HTML error handler.
  // Do not echo parser messages, submitted payloads, or stack traces to API clients.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const safeBodyError = classifyRequestBodyError(err);
    if (safeBodyError) {
      return res.status(safeBodyError.statusCode).json({ error: safeBodyError.message });
    }

    const errorName = err && typeof err === 'object' && 'name' in err && typeof (err as { name?: unknown }).name === 'string'
      ? (err as { name: string }).name.slice(0, 80)
      : 'UnknownError';
    console.error('Unhandled HTTP middleware error:', errorName);
    return res.status(500).json({ error: 'Internal server error.' });
  });

  // Setup Vite in Dev or Static files in Prod
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(path.resolve(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development')) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const listener = app.listen(PORT, HOST, () => {
    console.log(`PatchProof server running at http://${HOST}:${PORT} [Active Provider: ${getProviderState().activeProvider}] [Single-User Session Auth Enforced]`);
  });
  listener.on('error', (error: NodeJS.ErrnoException) => {
    const reason = error.code === 'EADDRINUSE'
      ? `Port ${PORT} is already in use.`
      : error.code === 'EACCES'
        ? `Permission denied while binding to port ${PORT}.`
        : 'The local server could not start.';
    console.error(`PatchProof startup error: ${reason}`);
    process.exitCode = 1;
  });
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  console.error(`PatchProof startup failed: ${sanitizeErrorMessage(message)}`);
  process.exitCode = 1;
});
