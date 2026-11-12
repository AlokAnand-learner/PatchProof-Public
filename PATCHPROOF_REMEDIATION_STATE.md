# PatchProof Security Audit & Remediation Tracking State
**Audit Source:** Independent Application Security Audit (Claude, 10 November 2026)  
**Remediation Role:** Senior Application Security Engineer & Software Architect  
**Initial Baseline Date:** 10 November 2026  

---

## 1. Remediation Status Legend
- `NOT REVIEWED`: Finding has not yet been inspected against the codebase.
- `CONFIRMED`: Inspected and verified to be present or partially vulnerable.
- `NOT REPRODUCED`: Inspected and verified absent or already mitigated.
- `FIXED — TEST PENDING`: Fix implemented in codebase; automated test in progress.
- `FIXED — TEST PASSED`: Fix implemented and verified with passing automated regression test.
- `BLOCKED`: Work cannot proceed due to external dependency or platform constraint.
- `DEFERRED WITH REASON`: Documented reason why fix is scheduled in a later stage.

---

## 2. Priority Zero (P0) — Critical Security Remediation Log

| ID | Vulnerability / Issue Description | Current Status | Affected Files | Fix Summary | Regression Test |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **SEC-01** | Prototype pollution via `__proto__`, `constructor`, `toString` in provider configuration | `FIXED — TEST PASSED` | `src/engine/providerEngine.ts`, `server.ts` | Strict allowlist `ALLOWED_PROVIDERS = new Set(['gemini', 'gemma', 'openai', 'anthropic', 'ollama', 'custom'])`, `Object.hasOwn` checks, null-prototype / Map backing, HTTP 400 rejection | `test/prototypePollution.test.ts` (17/17 passed) |
| **SEC-02** | Unauthenticated mutation routes & default wildcard server bind (`0.0.0.0`) | `FIXED — TEST PASSED` | `server.ts`, `src/utils/apiClient.ts` | Default bind to `127.0.0.1` (or env `HOST`), Host/Origin/Sec-Fetch-Site validation, timing-safe crypto token comparison, require session token on all mutating routes | `test/authBoundary.test.ts` (42/42 passed) |
| **SEC-03** | Server-Side Request Forgery (SSRF) & redirect bypass on provider endpoints | `FIXED — TEST PASSED` | `src/utils/ssrfValidator.ts`, `src/engine/providerEngine.ts` | Disallow redirects or re-validate redirect target with `validateEndpointUrl`; strict IP/DNS check; request timeout & payload limits | `test/ssrf.test.ts` (16/16 passed) |
| **SEC-04** | Offline-mode bypass via tricky hostnames (`localhost.evil.com`, etc.) & external font leaks | `FIXED — TEST PASSED` | `src/utils/ssrfValidator.ts`, `index.html`, `src/index.css` | Exact hostname parsing rejecting `.evil.com` suffixes; local self-hosted/system fonts without external Google Fonts link | `test/ssrf.test.ts` (16/16 passed) |
| **SEC-07** | ReDoS in SQL Injection detection regular expression (quadratic backtracking) | `FIXED — TEST PASSED` | `src/engine/contextAnalyzer.ts` | Linearized non-backtracking patterns; max line length constraint (4096 chars); timeout budget | `test/redos.test.ts` (4/4 passed) |
| **FIX-01** | Fix Validator trust failures: `?` alone certified as SQL parameterization | `FIXED — TEST PASSED` | `src/engine/fixValidator.ts` | Semantic verification of real parameter placeholder + tuple/array binding; reject comments containing `?` or nearby ternaries | `test/fixValidator.test.ts` (11/11 passed) |
| **FIX-02** | Fix Validator: Undefined variable detection & fake identifier resolution | `FIXED — TEST PASSED` | `src/engine/fixValidator.ts` | Comprehensive lexical identifier collector; flag undeclared variables without claiming complete AST if only heuristic | `test/fixValidator.test.ts` (11/11 passed) |
| **FIX-05** | Fix Validator: Structural balance failing on apostrophes in comments / ESM imports | `FIXED — TEST PASSED` | `src/engine/fixValidator.ts` | Strip comments before checking quotes/delimiters; handle ESM `import/export` syntax without `new Function` crashes | `test/fixValidator.test.ts` (11/11 passed) |
| **DET-01** | Detection evasion: Universal suppression via `Number()`, `int()`, `$1`, or `?` | `FIXED — TEST PASSED` | `src/engine/contextAnalyzer.ts` | Isolate suppression strictly to matching CWE; remove universal tokens | `test/accuracy.test.ts` (13/13 passed) |
| **DET-02** | Detection evasion: Rule names or test comments suppressing genuine findings | `FIXED — TEST PASSED` | `src/engine/contextAnalyzer.ts` | Strip comments before candidate check; do not suppress execution sinks due to rule identifiers | `test/accuracy.test.ts` (13/13 passed) |
| **DET-03** | Detection evasion: Secret detection disabled if variable named `token` | `FIXED — TEST PASSED` | `src/engine/contextAnalyzer.ts` | Fix secret rule logic so token assignments are properly evaluated | `test/accuracy.test.ts` (13/13 passed) |
| **SEC-10** | Production exposure: Vite middleware exposed in prod; rate-limiting unbounded | `FIXED — TEST PASSED` | `server.ts`, `package.json` | Pruning rate-limiter Map; skip static assets; proper security headers (CSP, HSTS, X-Content-Type-Options) | `test/uploadSafety.test.ts` & `test/prototypePollution.test.ts` |

---

## 3. Priority One (P1), Priority Two (P2) & Layout Fix Tracking Log

| ID | Issue Description | Status | Target Files | Verified Test |
| :--- | :--- | :---: | :--- | :--- |
| **LAY-01** | Sidebar overlap in full-screen mode & responsive flex-row shell | `FIXED — TEST PASSED` | `src/App.tsx`, `src/components/Navbar.tsx` | `test/layoutResponsiveness.test.ts` (9/9 passed) |
| **SEC-06** | Prompt injection: Uploaded code framed with structured tags, strict schema validation | `CONFIRMED` | `src/engine/providerEngine.ts`, `server.ts` | In providerEngine framing |
| **DET-04** | Disclose benchmark limitations honestly; do not claim 100% real-world accuracy | `CONFIRMED` | `src/components/SettingsView.tsx`, `src/data/evaluationSuite.ts` | Transparency disclosure in Settings |
| **FUNC-02** | Safe JSON response parsing with repair for truncated tokens and surrounding prose | `CONFIRMED` | `src/engine/providerEngine.ts` | `extractJsonFromModelResponse` |
| **FUNC-03** | Visible provider failures and honest fallback disclosures | `CONFIRMED` | `src/components/DeveloperToolsView.tsx`, `server.ts` | Diagnostic reporting |
| **SEC-09** | Remove misleading "encrypted in memory" claims; accurate localStorage explanation | `IMPLEMENTED — SOURCE REVIEWED` | `src/components/SettingsView.tsx` | Provider-dependent disclosure and unencrypted localStorage wording; runtime UI test pending |
| **SEC-05** | HTML & Markdown report injection prevention with strict enum allowlist | `CONFIRMED` | `src/utils/securityUtils.ts` | Sanitization utilities |
| **SEC-08** | ZIP extraction hardening & client/server upload limit alignment | `FIXED — TEST PASSED` | `src/utils/archiveUtils.ts`, `server.ts` | `test/uploadSafety.test.ts` (14/14 passed) |
| **A11Y-01** | Accessibility, dialog semantics, keyboard navigation, and theme consistency | `FIXED — TEST PASSED` | `src/components/Navbar.tsx`, `src/index.css` | `test/layoutResponsiveness.test.ts` |

---
**All automated test suites passing: 126/126 tests across 8 suites.**
- `test/authBoundary.test.ts`: 42/42 passed
- `test/prototypePollution.test.ts`: 17/17 passed
- `test/ssrf.test.ts`: 16/16 passed
- `test/uploadSafety.test.ts`: 14/14 passed
- `test/accuracy.test.ts`: 13/13 passed
- `test/fixValidator.test.ts`: 11/11 passed
- `test/layoutResponsiveness.test.ts`: 9/9 passed
- `test/redos.test.ts`: 4/4 passed

---

## 4. Independent Source-Workspace Changes — 11 November 2026

These entries were added after extracting the user's 10 November project archive. They are not claims that the entire application has been fully security-certified.

| ID | Change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **SEC-11** | Bound rate-limiter memory when many distinct client IPs arrive within one time window. Expired entries are pruned at capacity; if still full, the oldest entry is evicted before inserting a new one. | `IMPLEMENTED — FULL SERVER TEST PENDING` | `server.ts` | Server integration test not run in this workspace because project dependencies could not be installed. |
| **SEC-12** | Validate provider configuration object shape, allowed keys, field types, and maximum lengths; reject control characters in model/endpoint fields and line breaks in API keys. | `IMPLEMENTED — REGRESSION TEST PASSED` | `src/engine/providerEngine.ts`, `test/prototypePollution.test.ts` | Isolated provider configuration regression: 22/22 passed. |

### Verification performed in this workspace
- SSRF / credential masking: 16/16 passed.
- Fix validator: 11/11 passed.
- Detection evaluation: 13/13 passed (suite's own expected-outcome assertions; its reported metrics are not a claim of real-world accuracy).
- ReDoS: 4/4 passed.
- Responsive layout: 9/9 passed.
- Prototype pollution + new configuration validation: 22/22 passed.
- Total executed assertions across these six suites: 75 passed, 0 failed.
- Not run: auth-boundary integration and ZIP upload safety suites; required runtime dependencies were unavailable.
- Full TypeScript typecheck and production build: blocked because npm dependency installation timed out and `vite/client` / project dependencies are absent.

---

## 5. Independent Privacy & Consent Hardening — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **SEC-13 / H1** | Default browser history to source-redacted mode; automatically migrate legacy history; remove full source and full-file patches when privacy mode is enabled. | `FIXED — TARGETED TEST PASSED` | `src/utils/securityUtils.ts`, `src/components/SettingsView.tsx` | `test/historyPrivacy.test.ts`: 21/21 passed. Finding snippets/context remain by design. |
| **SEC-14** | Require cloud-transmission consent for remote custom OpenAI-compatible endpoints; permit only explicitly trusted loopback custom endpoints without cloud consent. | `FIXED — TARGETED TEST PASSED` | `src/engine/providerEngine.ts`, `server.ts` | `test/cloudConsent.test.ts`: 8/8 passed with mocked fetch. |
| **SEC-15** | Remove request-body consent override, require boolean consent values, and correct the Settings UI's consent request contract. Show the active provider/model/endpoint. | `IMPLEMENTED — SERVER INTEGRATION TEST PENDING` | `server.ts`, `src/components/SettingsView.tsx`, `src/types/security.ts`, `test/authBoundary.test.ts` | Auth-boundary regression assertions added but not executed because `tsx` and project dependencies are absent. |
| **SEC-09** | Correct privacy wording so provider retention/training is not promised by PatchProof; explain localStorage is not encrypted. | `IMPLEMENTED — SOURCE REVIEWED` | `src/components/SettingsView.tsx` | Syntax/transpile check passed; no UI runtime test available. |

### Verification limits for this section
- 29 targeted assertions passed across the two isolated suites (21 history + 8 consent).
- TypeScript syntax/transpilation passed for all modified TypeScript/TSX files.
- Full application tests, full typecheck, build and server integration tests remain blocked by missing dependencies.
- This does not certify the product for public deployment or confidential-code use.


## 6. AI Finding Validation Hardening — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **AI-01** | Reject malformed AI findings and fabricated/out-of-range line references; bound field sizes and finding count; derive snippets from actual source. | `IMPLEMENTED — ISOLATED TESTS PASSED` | `src/engine/aiFindingValidation.ts`, `server.ts` | 13 isolated Node assertions passed; TypeScript syntax/transpile passed. Full project suite pending dependencies. |
| **AI-02** | Prevent model-supplied labels from self-certifying findings or suppressing findings as false positives. All AI-originated findings are `NEEDS_REVIEW` / `AI_HYPOTHESIS`. | `IMPLEMENTED — SOURCE REVIEWED` | `server.ts` | Shared validator and both analysis paths inspected; isolated validator tests passed. |
| **AI-03** | Do not accept model-supplied full-file rewrite as authoritative analysis output. | `IMPLEMENTED — SOURCE REVIEWED` | `server.ts` | Original source remains the default; patch workflow remains separate. Runtime integration test pending. |

Verification caveat: no full app typecheck, full suite, or production build was possible because dependencies (`tsx`, Vite and Node type declarations) are absent in this workspace.

## 7. Upload Path & Server Boundary Hardening — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **UP-01** | Folder upload no longer falls back to a basename after rejecting an unsafe browser relative path; validates metadata and rejects normalized case-colliding duplicate paths. | `IMPLEMENTED — ISOLATED BEHAVIOR TESTS PASSED` | `src/utils/archiveUtils.ts`, `test/uploadSafety.test.ts` | Four isolated Node assertions passed against the compiled `processFiles` implementation; full suite blocked by missing `tsx`. |
| **UP-02** | Server-side multi-file analysis independently validates records, safe relative paths, supported extensions, path lengths, duplicate paths, content presence, and derives language server-side. | `IMPLEMENTED — SERVER INTEGRATION TEST ADDED / PENDING` | `server.ts`, `test/authBoundary.test.ts` | TypeScript transpilation passed; authenticated HTTP integration test added but not executed because project runtime dependencies are absent. |

**Critical release note:** Current authentication remains a single-user-local session-token boundary. No multi-tenant account model or per-user resource ownership system has been verified or implemented. Do not expose this build as a public multi-user SaaS until identity, tenant isolation, authorization tests, and deployment controls are implemented and independently verified.

### API surface review — 12 November 2026 (source inspection only)

| Route group | Current boundary observed | Public SaaS assessment |
| :--- | :--- | :--- |
| `/api/auth/session` | Unauthenticated bootstrap returns the process-wide local session token. | Not suitable as a public identity/session mechanism. Replace with per-user authentication and secure session issuance before public multi-user use. |
| `/api/analyze`, provider mutations, query/generation, fix validation, model discovery | Protected by the shared process-wide `requireSessionAuth` token. | Protects the current single-user local instance only; it does not identify users or enforce tenant/resource ownership. |
| `/api/status`, `/api/providers`, `/api/config` GET | Public read-only status/provider metadata; provider API keys are masked by `getPublicProviderConfigs()`. | Review for information minimization and tenant-specific configuration before SaaS. |
| `/api/evaluate`, `/api/fix/benchmark` | Public read-only evaluation/benchmark routes. | Review computational cost and rate limiting before public exposure. |

This is static route/source inspection, not a runtime penetration test. No user-account model, tenant identifiers, persistent server-side project ownership model, or cross-tenant authorization tests were found in this archive. Treat public multi-user launch as blocked until those controls exist.

### Client-side persistence inventory — 12 November 2026 (source inspection only)

| Browser storage key | Observed content | Security note |
| :--- | :--- | :--- |
| `patchproof_scan_history_v1` | Review history, findings, evidence, and (when privacy mode is explicitly disabled) complete source records. | Privacy mode defaults on and redacts full source/full-file patches; finding snippets and surrounding evidence remain. Browser localStorage is not encrypted and is accessible to same-origin JavaScript. |
| `patchproof_privacy_no_source` | Source-retention preference. | Defaults to privacy-on unless explicitly set to `false`. |
| `patchproof_advanced_settings` | Analysis preferences (thresholds, context lines, etc.). | No API key field in the inspected type; validate imported/legacy values before use. |
| `patchproof_theme` | Light/dark preference. | Non-sensitive preference. |
| `patchproof_sidebar_collapsed` | Sidebar display preference. | Non-sensitive preference. |

Provider credentials/configuration are held in the server-side provider state in this source; public config responses mask API keys. This archive does not show durable per-user server-side project storage. Treat localStorage as user-controlled and readable by any successful same-origin script; do not use it as a SaaS authorization boundary or store session secrets there.

## 8. Request Parsing & Pre-Body Authorization Hardening — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **HTTP-01** | Rate limiting now runs before JSON parsing to reduce unauthenticated request-parser resource exhaustion. | `IMPLEMENTED — ORDER REGRESSION PASSED` | `server.ts`, `test/middlewareOrder.test.ts` | Isolated middleware-order test passed; full Express integration not run. |
| **HTTP-02** | Protected API requests are authenticated before JSON parsing; only explicit public read-only endpoints and local session bootstrap bypass the pre-body guard. Existing route guards remain. | `IMPLEMENTED — INTEGRATION TEST ADDED / PENDING` | `server.ts`, `test/authBoundary.test.ts` | Unauthenticated malformed-JSON regression added; not executed because `tsx` and project dependencies are unavailable. |
| **HTTP-03** | Known JSON/body-parser errors return sanitized JSON 400/413/415 responses; unexpected middleware errors return a generic 500 without echoing payload/parser detail. | `IMPLEMENTED — 8/8 ISOLATED ASSERTIONS PASSED` | `src/utils/requestError.ts`, `server.ts`, `test/requestError.test.ts` | Eight isolated Node assertions passed; full server middleware integration remains pending. |

**Verification caveat:** TypeScript syntax/transpilation passed for all touched TypeScript files. Full tests, typecheck, build, and live HTTP integration remain blocked by missing `tsx`, Vite, and `vite/client` dependencies. This source-only remediation does not establish public SaaS readiness.

## 9. Provider Model Identifier Validation — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **PROV-01** | Provider activation and provider configuration now share strict model identifier validation (string only, max 128 chars, no control chars, no explicit null). Validation occurs before provider state mutation. | `IMPLEMENTED — 9/9 ISOLATED ASSERTIONS PASSED` | `src/utils/modelName.ts`, `src/engine/providerEngine.ts`, `test/modelName.test.ts` | Nine isolated Node assertions passed; provider module integration suite not run because dependencies are unavailable. |
| **PROV-02** | Authenticated provider activation API regression rejects newline-containing model names. | `INTEGRATION TEST ADDED / PENDING` | `test/authBoundary.test.ts` | Added expected HTTP 400 assertion; full HTTP test not executed (`tsx` missing). |

## 10. Provider Error & Credential Redaction Hardening — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **PRIV-01** | Expanded provider error redaction for URL userinfo, auth headers, common cloud/API tokens, JWT-shaped values, query-string secrets, and key/value secrets; strips controls and caps output at 500 characters. | `FIXED — 23/23 SSRF & REDACTION TESTS PASSED` | `src/utils/ssrfValidator.ts`, `test/ssrf.test.ts` | Isolated compiled Node suite passed 23/23 assertions; no real credentials used. |

## 11. Provider Response Size & Timeout-Boundary Hardening — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **PROV-03** | Bound streamed provider response bodies and reject oversized declared/chunked responses; generic JSON parse errors do not echo provider content. | `IMPLEMENTED — 8/8 ISOLATED ASSERTIONS PASSED` | `src/utils/httpResponse.ts`, `test/httpResponse.test.ts` | Eight isolated Node assertions passed with synthetic `Response`/`ReadableStream` bodies. |
| **PROV-04** | Keep abort timers active through response body consumption and clear timers in `finally` for Ollama and OpenAI-compatible/Anthropic fetch paths. | `IMPLEMENTED — SOURCE REVIEW + UTILITY TESTS` | `src/engine/providerEngine.ts` | Transpilation passed; provider integration tests were not executable because project dependencies are unavailable. |

**Scope note:** Google GenAI SDK calls still rely on SDK-managed transport behavior and do not yet have an independently enforced response-byte cap in this application layer.

## 12. Consolidated Verification & Remaining SSRF DNS Risk — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **VERIFY-01** | Consolidated source syntax/transpile scan and isolated regression suites. | `50 FILES SYNTAX-CHECKED; ISOLATED SUITES PASSED` | `server.ts`, `src/`, `test/` | 50 TypeScript files had zero transpile diagnostics; isolated suites: request errors 8/8, model names 9/9, bounded responses 8/8, SSRF/redaction 23/23, middleware order passed. |
| **SSRF-DNS-01** | Remote hostname resolution is not pinned to a vetted public IP for the actual outbound connection; DNS rebinding/private-resolution risk remains for custom remote endpoints. | `OPEN — P0 RELEASE BLOCKER` | `src/utils/ssrfValidator.ts`, `src/engine/providerEngine.ts` | Source inspection only. Requires DNS-pinned transport/egress enforcement and mocked DNS regression tests. |

Full `npm test`, typecheck, and production build remain blocked by missing project dependencies. Public multi-user release remains prohibited until identity/tenant isolation, DNS-pinned SSRF controls, and full integration verification are complete.


## 8. Current product scope — LOCALHOST ONLY

**Current phase:** single-user, local-host application. Do not prioritize or implement public SaaS identity, tenant isolation, account management, or cloud deployment during this phase. Focus development effort on internal product quality: analysis correctness, finding validation, upload and archive safety, local AI/provider reliability, privacy, reports, UI stability, performance, recovery, and maintainable tests.

**Local boundary:** server must bind only to loopback (`localhost`, `127.0.0.1`, or `::1`); Host and Origin checks must reject LAN and third-party hosts. Remote AI provider calls are a separate, explicit user-consented feature and do not imply public hosting.

**Deferred publication gate:** when the user explicitly decides to publish, perform a separate architecture and security phase covering real identity/session lifecycle, per-user ownership and tenant isolation, durable data model, deployment/network controls, secret management, monitoring, and independent security verification. Do not let this deferred checklist distract from current local product improvements.


## 9. Local product accuracy and documentation

User-facing documentation now describes the provider-neutral local-first architecture, distinguishes deterministic pattern matches from exploitability, treats AI findings as unverified suggestions, discloses unencrypted browser localStorage, and describes explicit remote-provider consent. Stale AI Studio deployment assumptions and unsupported availability guarantees were removed.


## 10. Local analysis accuracy and classification calibration — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **ANALYSIS-01** | Nearby source/sink heuristics no longer claim `CONFIRMED` or `TAINT_FLOW_ANALYSIS`; they produce `LIKELY` and require review until real data-flow proof exists. | `IMPLEMENTED` | `src/engine/contextAnalyzer.ts` | 13/13 evaluation fixtures passed with expected classifications enforced. |
| **ANALYSIS-02** | Test/demo/docs context detection now uses path segments and filename tokens, avoiding arbitrary substring matches. | `IMPLEMENTED` | `src/engine/contextAnalyzer.ts`, `test/contextAnalyzerContext.test.ts` | Included in 26/26 isolated context assertions. |
| **ANALYSIS-03** | Executable code after a multiline comment's closing delimiter is no longer skipped; trailing comments remain ignored. | `IMPLEMENTED` | `src/engine/contextAnalyzer.ts`, `test/contextAnalyzerContext.test.ts` | Regression for a command sink after `*/` passed; comment-only suffix case passed. |
| **ANALYSIS-04** | Dashboard no longer advertises a taint-analysis-only filter unsupported by the current local engine. | `IMPLEMENTED` | `src/components/DashboardView.tsx` | Source change syntax-checked; UI runtime not available. |

**Verification caveat:** TypeScript transpile/syntax scan covered 53 TS/TSX files with zero diagnostics. Full `npm test`, typecheck, and Vite build remain blocked by missing `tsx`, `vite/client`, and `vite` dependencies. This is not a claim of full application integration verification.


## 11. Report output integrity and privacy wording — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **REPORT-01** | Corrected local transmission wording so reports do not claim analysis is “in-memory only” while review history may be stored in browser localStorage. | `IMPLEMENTED` | `src/utils/securityUtils.ts` | Report safety regression passed. |
| **REPORT-02** | Removed invented 75% fix-validation confidence when validation has not run; reports now say “not executed”. | `IMPLEMENTED` | `src/utils/securityUtils.ts` | 8/8 isolated report assertions passed. |
| **REPORT-03** | Bounded HTML report numeric interpolations from tampered history data and corrected static-rule method labeling. | `IMPLEMENTED` | `src/utils/securityUtils.ts` | Hostile numeric values did not escape into generated HTML; report regression passed. |

**Known limitation:** This change does not implement a full Markdown-renderer-specific sanitizer. HTML report string fields remain HTML-escaped; numeric fields are finite/bounded. Full project integration tests remain blocked by missing dependencies.

## Detection precision update — 2026-11-12

- **Completed:** Removed unsound nearby-context sanitizer suppression for CWE-89, CWE-22, CWE-79, CWE-502, and CWE-338. These controls are no longer accepted as proof unless the current bounded logic can tie the same request-derived value to the XSS output.
- **Completed:** Added synthetic regression tests ensuring unrelated encoders, prepared statements, basename calls, JSON parsing, object filters, and CSPRNG calls do not silently suppress unrelated findings.
- **Verification:** 13-case synthetic evaluation passes with 0 FP / 0 FN; 18 sanitization assertions pass. These metrics apply only to the small hand-authored suite.
- **Remaining:** Real variable/data-flow, framework-aware output context, control-flow, interprocedural call graph, and comprehensive language coverage are not implemented. Keep findings labelled LIKELY or NEEDS_REVIEW until independently verified. Do not market the current engine as zero-false-positive or production-grade.

## Detection precision update — explicit local source-to-sink indicator (2026-11-12)

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **ANALYSIS-05** | Removed generic variable-name taint indicators. Only recognized input expressions count, and a local assignment must feed the candidate sink variable; unrelated source variables do not elevate the finding. | `IMPLEMENTED — SYNTHETIC REGRESSIONS PASS` | `src/engine/contextAnalyzer.ts`, `test/sanitizationPrecision.test.ts` | Same-variable source/sink, unrelated source, and reassignment fixtures passed. |
| **ANALYSIS-06** | Unknown parameters such as `rawPayload` no longer imply user control; dangerous sinks without a recognized source remain `NEEDS_REVIEW`. | `IMPLEMENTED` | `src/data/evaluationSuite.ts`, `src/engine/contextAnalyzer.ts` | 13/13 evaluation fixtures pass with the Java deserialization example downgraded to `NEEDS_REVIEW`. |
| **VERIFY-02** | Recovered partial regression coverage with globally available TypeScript/ts-node despite missing project dependencies. | `PARTIAL — 15/19 TEST FILES EXECUTED` | `test/`, `package.json` | 15 passed; 4 blocked by missing `jszip`, `@google/genai`, or unavailable local server. 56 TS/TSX files transpiled with zero syntax diagnostics. |

**Dependency installation blocker:** npm install timed out; npm registry DNS resolution returned `EAI_AGAIN`. No dependencies were installed. Full `tsc`, Vite build, upload/provider integration tests, and HTTP auth-boundary test remain pending until network/package availability and Express server dependencies are available.

## Phase 1 foundation audit — 12 November 2026

| ID | Finding / change | Status | Files | Verification |
| :--- | :--- | :---: | :--- | :--- |
| **FOUND-01** | Package identity/version, Node engine requirement, `.nvmrc`, test/typecheck scripts, Bun workspace name aligned. | `IMPLEMENTED` | `package.json`, `bun.lock`, `.nvmrc` | Manifest inspected; dependency install remains blocked by npm registry DNS. |
| **FOUND-02** | Runtime host/port validation; only loopback bind addresses; malformed/empty/out-of-range ports rejected. | `IMPLEMENTED` | `src/utils/runtimeConfig.ts`, `server.ts`, `test/runtimeConfig.test.ts` | 17/17 isolated assertions passed. |
| **FOUND-03** | Express proxy trust disabled, `X-Powered-By` disabled, WebSocket CSP narrowed to loopback. | `IMPLEMENTED — SOURCE/SYNTAX CHECK` | `server.ts` | Included in 59-file zero-diagnostic transpile scan; full runtime test blocked by missing dependencies. |
| **FOUND-04** | Single-file filename/path label constrained to a safe supported basename; invalid client language labels fall back to server detection. | `IMPLEMENTED` | `src/utils/archiveUtils.ts`, `server.ts`, `test/singleFileName.test.ts` | 23/23 isolated filename/path assertions passed. |
| **FOUND-05** | ZIP entry metadata iteration capped; path controls, ambiguous separators, and overlong relative paths rejected. | `IMPLEMENTED — PARTIAL INTEGRATION VERIFICATION` | `src/types/security.ts`, `src/utils/archiveUtils.ts`, `test/uploadSafety.test.ts` | Syntax scan passed; full JSZip-backed archive test blocked because dependencies are not installed. |
| **FOUND-06** | Architecture and foundation acceptance criteria documented; README setup and limitations corrected. | `IMPLEMENTED` | `README.md`, `docs/ARCHITECTURE.md`, `docs/FOUNDATION_ACCEPTANCE.md` | Manual content review. |
| **FOUND-07** | Full project dependency install, typecheck, build, full test suite, and upload-to-analysis smoke test. | `OPEN — ENVIRONMENT BLOCKER` | `package.json`, project dependencies | npm install timed out with registry `EAI_AGAIN`; `tsx`, `vite`, and `vite/client` are unavailable. |

**Phase 1 acceptance decision:** Not yet complete. Implementation improvements are in place, but no 100% completion claim is permitted until FOUND-07 is verified.
