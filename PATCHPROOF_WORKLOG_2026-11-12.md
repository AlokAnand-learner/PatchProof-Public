# PatchProof implementation worklog — 12 November 2026

## Priority task completed
Addressed two related privacy boundaries: browser history source retention and explicit consent for remote AI destinations.

## Source changes
1. `src/utils/securityUtils.ts`
   - Privacy mode now defaults to enabled unless the user explicitly opted out earlier.
   - Existing legacy history is automatically scrubbed on read when privacy mode is enabled.
   - Enabling privacy mode also scrubs already-saved history immediately.
   - Full source files, full-file patches, per-file contents and per-file patches are removed from saved history; finding snippets and surrounding evidence remain.
   - Storage-quota fallback uses the same redaction helper.
2. `src/components/SettingsView.tsx`
   - Replaced unverifiable provider-retention/training assurances with accurate provider-dependent disclosure.
   - Displays the active provider, model and endpoint beside the cloud-consent control.
   - Fixed the consent request to send JSON with `Content-Type: application/json` and the server's expected `{ granted: boolean }` field.
   - Shows a visible error if the consent preference cannot be updated.
   - Explains that privacy mode is on by default and that finding evidence snippets remain in history.
3. `src/engine/providerEngine.ts`
   - Added `requiresCloudConsent()` so remote custom OpenAI-compatible endpoints require consent, while trusted loopback custom endpoints do not.
   - Allowed explicitly trusted custom loopback endpoints on the existing local-port allowlist; remote custom endpoints still require HTTPS.
   - Applied the same consent guard before any custom remote AI request.
4. `server.ts`
   - Removed request-body `allowCloudAi` as a consent override; only server-side consent authorizes cloud transmission.
   - Classified remote custom endpoints as cloud destinations and local custom loopback endpoints as local.
   - Exposed the active endpoint in status output for user disclosure; no credentials are included.
   - Requires a real boolean for cloud-consent changes instead of truthy coercion.
5. `src/types/security.ts`: added the optional active endpoint to `SystemStatus`.
6. Tests:
   - Added `test/historyPrivacy.test.ts` (legacy migration, default-on behavior, existing-history scrubbing, full-file and per-file redaction, opt-out behavior).
   - Added `test/cloudConsent.test.ts` (hosted provider, remote custom, local custom and mocked-fetch boundary checks).
   - Extended `test/authBoundary.test.ts` for the Settings consent route, invalid consent values, and the rejected `allowCloudAi:true` override.
   - Added both new suites to the package test script.

## Verification actually run
- History privacy regression suite: **21 passed, 0 failed**. Compiled the relevant TypeScript with global TypeScript 5.8.3 and executed the compiled test under Node 22.16.0.
- Cloud-consent regression suite: **8 passed, 0 failed**. Executed in an isolated transpiled workspace with a stub Google SDK and mocked `fetch`; no provider network request was made.
- Syntax/transpile checks: passed for `server.ts`, `providerEngine.ts`, `securityUtils.ts`, `SettingsView.tsx`, `SystemStatus` types, and the three relevant test files.

## Blocked verification
- `npm test`: blocked because project dependencies are absent (`tsx: not found`). The expanded server integration suite was not run.
- `npm run lint`: blocked because `vite/client` type definitions are unavailable.
- `npm run build`: blocked because Vite is not installed (`vite: not found`).
- No dependency installation was attempted in this run; prior attempts to install this archive's dependencies timed out.
- The source was not deployed and no external AI provider was contacted.

## Important behavior note
- Existing users with no saved privacy preference are migrated to privacy-on and their full source history is scrubbed when history is first read.
- Users who had explicitly set source storage to off (`patchproof_privacy_no_source=false`) retain that explicit opt-out until they enable privacy mode. Enabling it scrubs existing history.
- Finding snippets and surrounding context remain in history by design; they can contain small excerpts of code.

## Next task
Review and harden server-side AI response schema validation and line-range bounds in both single-file and multi-file analysis paths. Keep model output untrusted and do not let model-supplied verification labels imply independently confirmed findings.

## Independent defensive validation hardening — 12 November 2026 (continued)

### Priority task completed in source workspace
Hardened AI-generated finding ingestion for both single-file and multi-file analysis.

### Files changed
1. `src/engine/aiFindingValidation.ts` (new)
   - Validates model findings as untrusted input.
   - Rejects non-object entries, non-integer line numbers, zero/negative lines, reversed ranges, out-of-file ranges, and ranges wider than 200 lines.
   - Caps accepted findings at 100 and bounds text fields.
   - Derives displayed snippets from the actual source rather than trusting model-supplied snippets.
   - Normalizes severity/confidence to allowlisted values.
2. `server.ts`
   - Applies the shared validator in single-file and multi-file analysis.
   - Forces all AI-originated findings to `NEEDS_REVIEW` / `AI_HYPOTHESIS`; a model cannot self-certify a finding as `CONFIRMED` or suppress one as `FALSE_POSITIVE`.
   - Bounds summary/recommendation output.
   - Ignores the model's `patchedFullCode` response; original source remains in place until a separate patch-validation flow approves a change.
3. `test/aiFindingValidation.test.ts` (new)
   - Adds regression coverage for source-grounded snippets, fabricated and invalid ranges, malformed records, count caps, bounded fields, and enum normalization.
4. `package.json`
   - Adds the focused test suite to `npm test`.

### Verification actually run
- TypeScript `transpileModule` syntax/transpile checks: passed for `server.ts`, the new validator, and its test.
- Compiled the standalone validator with the globally available TypeScript compiler and ran isolated Node assertions: **13 passed**.
- No AI provider was contacted; all test inputs were synthetic.

### Verification blocked
- Full project test suite and test file execution through `tsx`: blocked because project dependencies and `tsx` are not installed in this workspace.
- Full typecheck/build: not run; project dependencies and Vite type definitions are unavailable. A standalone strict compile of the test was also blocked by missing Node type declarations (`@types/node`).

### Next task
Continue the ASVS-oriented security review with upload/extraction and tenant/data isolation boundaries, then add regression tests before making any deployment claims. Do not deploy or transmit source to external services.

## Upload boundary hardening — 12 November 2026 (continued)

### Issue identified
A source review found that folder uploads used `sanitizeRelativePath(rawPath) || file.name`. If the browser-supplied relative path was unsafe, the code silently fell back to the basename and could still accept the file. The server-side multi-file analysis route also trusted client-supplied file paths and language labels instead of independently validating them.

### Changes made
1. `src/utils/archiveUtils.ts`
   - Folder upload now rejects an unsafe or invalid `webkitRelativePath` / filename instead of falling back to `file.name`.
   - Rejects duplicate and case-colliding normalized relative paths to avoid cross-platform path ambiguity.
   - Validates file size metadata before reading file contents.
   - Derives the project name only from a validated relative path.
2. `server.ts`
   - Independently validates multi-file request records, relative paths, supported source extensions, and path length at the server boundary.
   - Rejects traversal/absolute/unsupported paths, malformed file records, empty content, and duplicate/case-colliding paths.
   - Derives language from the validated filename and source content rather than trusting the client-provided language field used in AI prompt construction.
   - Bounds project name length.
   - Returns rejected-entry details and a count; responds with HTTP 400 if no valid source files remain, preventing an empty-input false-clean report.
3. `test/uploadSafety.test.ts`
   - Added folder-upload regressions for traversal path fallback, recorded rejection, and case-colliding duplicates.
4. `test/authBoundary.test.ts`
   - Added authenticated multi-file API regression coverage for traversal, case-collision, server-derived language, skipped-entry reporting, and all-invalid upload rejection.

### Verification actually run
- TypeScript `transpileModule` syntax/transpilation: passed for `server.ts`, `src/utils/archiveUtils.ts`, `test/uploadSafety.test.ts`, and `test/authBoundary.test.ts`.
- Executed the actual compiled `processFiles` function in an isolated Node harness with a stubbed unused JSZip dependency and synthetic file objects: **4/4 assertions passed** (unsafe relative path rejection, rejection recorded, case-collision rejection, absolute Windows path rejection).
- No external service or AI provider was contacted; no real project source was processed.

### Verification blocked / not run
- `npm test`: blocked (`tsx: not found`). The new server integration regression was added but not executed.
- `npm run lint`: blocked (`vite/client` type definitions unavailable).
- `npm run build`: blocked (`vite: not found`).
- Git diff checks unavailable because the supplied source archive has no `.git` repository. Timestamped copies of both edited files were made before changes.

### Remaining security boundary
PatchProof still advertises and implements a `single-user-local` session boundary, not real multi-tenant authentication/authorization. These upload fixes improve untrusted input handling but do not make the current application safe for public multi-user deployment. A future SaaS release still requires a real identity/session system, per-user/tenant ownership checks for every resource, and isolation tests.

### Next task
Map every API route and stored resource, then design and implement a coherent authenticated ownership boundary (or explicitly keep the product local-only until that architecture exists). Add synthetic two-user isolation tests before claiming multi-user readiness.

### Follow-on API surface review — source inspection only
Reviewed all Express route declarations after the upload changes. Mutating/analysis routes use the process-wide `requireSessionAuth` token; `/api/auth/session` intentionally bootstraps that token without authentication for the current local-only model. Public provider/status/config GET routes expose metadata and use `getPublicProviderConfigs()` which masks stored API keys. Evaluation and benchmark routes are also public read-only endpoints. This does not constitute tenant isolation: no per-user identity, tenant ownership checks, or cross-tenant resource model is present in the inspected archive. Public SaaS remains blocked pending a dedicated identity and authorization architecture.

### Client persistence inventory — source inspection only
Inspected all `localStorage` / `sessionStorage` / IndexedDB references in the supplied source. Current keys are review history, source-retention preference, analysis preferences, theme, and sidebar state. History privacy mode defaults on and removes full source/full-file patches, but keeps finding snippets and surrounding evidence; localStorage remains unencrypted and same-origin script-readable. Analysis preferences contain thresholds/toggles/context-lines only in the inspected type. No IndexedDB usage or durable server-side per-user project database was found. This reinforces that browser storage is not a tenant boundary and the current app remains local-first/single-user.

## Request parsing and pre-body authorization hardening — 12 November 2026 (continued)

### Changes made
1. `server.ts`
   - Moved the bounded IP rate limiter ahead of `express.json()` so request floods are throttled before JSON parsing consumes CPU and memory.
   - Added `preBodyAuthGuard` ahead of JSON parsing. It permits only explicitly public read-only GET/HEAD endpoints and the local session bootstrap; other API methods and protected API reads must present the local session token before their request bodies are parsed. Existing route-level authorization remains in place as defense in depth.
   - Added a final Express error middleware before static/Vite fallback to return sanitized JSON for known body-parser errors and a generic 500 response for unexpected middleware errors. It logs only a bounded error name, not submitted payloads, parser messages, or stack traces.
2. `src/utils/requestError.ts` (new)
   - Maps oversized JSON, malformed JSON, unsupported encoding/charset, and aborted-body errors to safe 400/413/415 responses.
3. `test/requestError.test.ts` (new)
   - Adds eight isolated assertions covering known parser errors, unknown errors, null values, and ensuring parser details are not echoed.
4. `test/middlewareOrder.test.ts` (new)
   - Guards the middleware order: host/origin/security headers, rate limiting, pre-body auth, then JSON parsing.
5. `test/authBoundary.test.ts`
   - Adds an integration regression asserting unauthenticated malformed JSON to `/api/analyze` is rejected with 401 before the JSON parser processes it.
6. `package.json`
   - Adds the new request-error and middleware-order suites to the full test command.

### Verification actually run
- TypeScript transpile/syntax checks passed for `server.ts`, `src/utils/requestError.ts`, `test/requestError.test.ts`, `test/middlewareOrder.test.ts`, and `test/authBoundary.test.ts`.
- Isolated request error sanitizer suite: **8/8 passed**.
- Middleware order regression: **passed**.
- The new authenticated HTTP integration assertion was added but not executed.

### Verification blocked
- `npm test`: blocked, `tsx: not found`.
- `npm run lint`: blocked, missing `vite/client` type definitions.
- `npm run build`: blocked, `vite: not found`.
- Full HTTP integration suite not run because runtime dependencies are absent.
- Source archive has no `.git` directory, so git status/diff checks are unavailable. Timestamped backups were created before editing.

### Residual risks and next priority
- The current session token remains a single-user-local boundary, not user identity or multi-tenant authorization. The public bootstrap endpoint intentionally returns that local token and must be replaced before SaaS exposure.
- The 25 MB JSON parser limit is retained to match current archive upload expectations; pre-body rate limiting and authorization reduce unauthenticated parser exposure but do not replace a future streaming upload architecture.
- Next: inspect server-side provider configuration and process-wide state for isolation/credential lifecycle issues, then design a staged identity/tenant architecture without breaking the local-first mode. Do not deploy.

## Provider model identifier validation — 12 November 2026 (continued)

### Changes made
1. `src/utils/modelName.ts` (new)
   - Adds a shared model-name normalizer that rejects non-string values, explicit nulls, control characters, and identifiers longer than 128 characters; trims valid values and treats only omitted/blank values as no override.
2. `src/engine/providerEngine.ts`
   - Applies the shared validation in both `setActiveProvider()` and `updateProviderConfig()` before mutating provider state, preventing the activation API from bypassing the stricter configuration validation.
3. `test/modelName.test.ts` (new)
   - Adds nine isolated boundary assertions for valid normalization, maximum length, overlength, control characters, null, and non-string input.
4. `test/authBoundary.test.ts`
   - Adds an authenticated API regression for a model name containing a newline; expected response is HTTP 400.
5. `package.json`
   - Adds the model-name regression suite to the full test command.

### Verification actually run
- TypeScript transpile/syntax checks passed for `server.ts`, `providerEngine.ts`, both new utilities, and all touched/new tests.
- Model-name validator: **9/9 isolated assertions passed**.
- Request error sanitizer: **8/8 isolated assertions passed**.
- Middleware order regression: **passed**.
- Authenticated HTTP regression is added but not executed.

### Remaining blockers
- `npm test`: `tsx` unavailable.
- `npm run lint`: missing `vite/client` type definitions.
- `npm run build`: Vite unavailable.
- No live Express server integration or production build was run.

### Next priority
- Continue provider-boundary review: verify provider state mutation behavior, endpoint validation consistency, and credential exposure through errors/status responses. Then continue mapping the missing per-user identity and tenant ownership architecture. Do not deploy.

## Provider error and credential redaction hardening — 12 November 2026 (continued)

### Changes made
1. `src/utils/ssrfValidator.ts`
   - Expanded error redaction to cover URL userinfo, Bearer/Basic authorization values, Google API keys, OpenAI/Anthropic-style keys, common GitHub/Slack tokens, AWS access-key IDs, JWT-shaped values, and secret-bearing query/key-value fields.
   - Removes control characters and caps untrusted error text at 500 characters before it reaches UI/API responses.
2. `test/ssrf.test.ts`
   - Added regression assertions for generic API keys, URL query tokens, URL userinfo passwords, JWTs, GitHub tokens, output length bounds, and control-character removal.

### Verification actually run
- Executed the compiled SSRF and credential-masking suite in an isolated Node workspace: **23/23 passed** (including all prior SSRF checks and new redaction cases).
- TypeScript transpilation passed for the sanitizer and test.

### Next priority
- Continue reviewing provider test/analysis timeout cleanup and response-size bounds; ensure timers are always cleared and remote provider error bodies cannot cause excess memory use. Then resume identity and tenant-boundary architecture planning.

## Provider response size and timeout-boundary hardening — 12 November 2026 (continued)

### Changes made
1. `src/utils/httpResponse.ts` (new)
   - Adds streaming response-body reads with a strict byte ceiling, early rejection when `Content-Length` exceeds the limit, cancellation when streamed bytes exceed the ceiling, and generic JSON parse errors that do not echo provider response content.
2. `src/engine/providerEngine.ts`
   - Added a shared fetch helper that keeps its `AbortController` timer active through complete response-body consumption and always clears the timer in `finally`.
   - Applied bounded body reads to Ollama model discovery, provider connection tests for OpenAI-compatible/Anthropic endpoints, and analysis responses from Ollama/OpenAI-compatible/Anthropic providers.
   - Uses a 1 MiB cap for Ollama tags, 64 KiB for connection-test responses, and 2 MiB for analysis responses.
3. `test/httpResponse.test.ts` (new)
   - Adds eight isolated checks for normal/exact-boundary responses, declared and chunked oversize bodies, valid/invalid JSON, invalid limits, and bodyless responses.
4. `package.json`
   - Adds the bounded-response suite to the full test command.

### Verification actually run
- Bounded response utility suite: **8/8 isolated assertions passed** using Node's built-in `Response` and `ReadableStream` implementations.
- TypeScript transpile checks passed for the modified provider engine and new helper/test.
- Previous SSRF/redaction, model-name, request-error, and middleware-order isolated suites remain recorded as passing earlier in this run.

### Remaining verification gaps
- Google GenAI SDK calls are still managed by the SDK; this change does not independently impose a streaming response byte cap or explicit abort timeout on those SDK internals.
- Full project test, typecheck, and build remain blocked by missing `tsx`, Vite, and `vite/client` dependencies.
- No real provider endpoint was contacted; tests use synthetic local responses only.

### Next priority
- Review provider configuration/state for remaining process-wide assumptions and credential lifecycle issues. Public SaaS remains blocked until identity and tenant ownership are designed and independently tested.

## Consolidated verification and residual-risk review — 12 November 2026

- Transpiled **50 TypeScript/TSX files** across `server.ts`, `src/`, and `test/`: zero syntax/transpile diagnostics.
- Executed isolated regression suites in a temporary Node workspace: request-error sanitization **8/8**, model-name validation **9/9**, bounded provider response handling **8/8**, SSRF/credential redaction **23/23**, middleware order **passed**. These are isolated suites, not the full application test run.
- Re-attempted `npm test`: blocked (`tsx: not found`).
- Re-attempted `npm run lint`: blocked (missing `vite/client` type definitions).
- Re-attempted `npm run build`: blocked (`vite: not found`).
- Parsed `package.json`: passed. No real provider endpoints or external targets were contacted.

### Additional SSRF residual risk explicitly recorded
`validateEndpointUrl()` currently rejects literal private/loopback IPs and metadata hostnames, but it does not resolve arbitrary remote hostnames and pin a vetted public address to the actual outbound connection. A hostname that resolves or rebinds to a private address may therefore remain a risk on custom remote endpoints. Do not treat the current SSRF guard as complete against DNS rebinding, and do not expose custom remote endpoint configuration publicly until a DNS-pinned outbound transport or equivalent egress boundary is implemented and tested with mocked DNS. This is a priority-zero release blocker for public multi-user use.


## 12 Nov 2026 — Localhost-only development scope

The product scope is now explicitly single-user localhost for the current development phase. Public SaaS identity, tenant isolation, account management, and cloud deployment work are deferred until publication is an active goal.

Implemented local-only boundary tightening:
- Server binds to `127.0.0.1` by default even in container-detected environments. An explicit `HOST` override is accepted only for `localhost`, `127.0.0.1`, or `::1`; non-loopback bind configuration fails at startup.
- Host-header validation now accepts only exact loopback hostnames, correctly parsing bracketed IPv6 and optional ports. LAN IPs, `0.0.0.0`, cloud preview hosts, and custom hosts are rejected.
- Origin validation now accepts only HTTP(S) loopback origins; Google AI Studio, Cloud Run preview, and custom origins are no longer accepted in this local-only phase.
- CSP frame ancestors are restricted to self; third-party embedding is not part of the local-host product mode.
- Added `localHostPolicy.test.ts` with 25 synthetic host/origin policy assertions and wired it into `npm test`.

Verification status: source changes are subject to syntax checks and isolated unit assertions. Full application tests, lint/typecheck, and production build remain dependent on installing the project's declared dependencies; no dependency installation or network access was performed.

## 12 Nov 2026 — Local product documentation accuracy

Updated user-facing methodology and setup documentation to match the actual local-first architecture:
- Removed stale AI Studio deployment branding and external preview references from the README.
- Simplified `.env.example` to optional Gemini credentials and loopback-only host/port settings.
- Replaced fixed Gemini/model claims with provider-neutral descriptions.
- Clarified that deterministic pattern matches do not prove exploitability, and AI findings remain unverified suggestions.
- Disclosed browser `localStorage` is not encrypted and explained the distinction between local Ollama processing and explicitly consented remote-provider transmission.
- Removed unsupported guarantees that fallback analysis or patch generation will remain fully operational under all conditions.

Verification: changed TypeScript sources passed TypeScript transpilation checks; full build and project test suite remain blocked because dependencies (`tsx`, Vite, and project type packages) are not installed in this working copy.


## Local analysis accuracy and classification calibration — 12 November 2026 (continued)

### Changes made
1. `src/engine/contextAnalyzer.ts`
   - Changed the heuristic context classifier so nearby source/sink indicators produce `LIKELY`, not `CONFIRMED`. The current engine uses bounded patterns and nearby-context checks; it does not prove variable-level data flow or control-flow reachability.
   - Static findings now consistently identify as `STATIC_RULE_MATCH` / `CONTEXTUAL_HEURISTIC` and retain `UNVERIFIED_REVIEW_REQUIRED` patch status. The engine no longer labels these heuristic findings as `TAINT_FLOW_ANALYSIS` or statically verified patches.
   - Improved file-context classification to match actual test/demo/docs path segments and conventional filename tokens instead of arbitrary substrings (e.g. `contest.py` and `latest_service.ts` are no longer misclassified as tests).
   - Fixed a block-comment handling false negative: executable code following a closing multiline-comment delimiter on the same line is no longer discarded; trailing line/block comments remain ignored.
2. `src/data/evaluationSuite.ts`
   - Corrected expected classifications to reflect the engine's actual evidence level.
   - Made `expectedClassification` an enforced part of each evaluation case instead of unused metadata. All 13 fixture cases now verify both detection outcome and classification.
3. `src/components/DashboardView.tsx`
   - Removed the misleading “Taint Analysis Only” filter because the current local engine does not implement proven taint-flow analysis.
4. `test/contextAnalyzerContext.test.ts` (new) and `package.json`
   - Added 26 regression assertions for test/demo path classification, misleading substrings, Windows paths, multiline-comment closure, and conservative finding labels. Added the suite to the normal test command.

### Verification actually run
- Context analyzer regression suite: **26/26 assertions passed** in an isolated Node harness using TypeScript transpilation.
- Accuracy evaluation suite: **13/13 cases passed**, with zero false positives and exact expected classifications enforced.
- TypeScript transpile/syntax scan: **53 TS/TSX files, zero syntax diagnostics**.
- `npm test`: blocked (`tsx` is not installed).
- `npm run lint`: blocked (missing `vite/client` type definitions).
- `npm run build`: blocked (`vite` is not installed).
- No external providers or targets contacted; all fixtures are synthetic.

### Product impact and remaining limits
The UI will no longer overstate heuristic findings as confirmed taint flows. Strong local source/sink indicators remain visible as high-confidence `LIKELY` findings pending manual or future AST/data-flow verification. The current rule engine is still not a full parser, AST, control-flow graph, or interprocedural taint engine.


## Report output integrity and privacy wording — 12 November 2026 (continued)

### Changes made
1. `src/utils/securityUtils.ts`
   - Local reports now say “Local analysis (no remote AI transmission recorded)” rather than “100% In-Memory Local”, which incorrectly implied that browser-persisted review history was never stored.
   - Markdown report method labels no longer call static rule matching `STATIC_AST_CHECK`.
   - Reports no longer invent a default 75% validation confidence when fix validation has not run; Markdown and HTML explicitly state that validation was not executed.
   - HTML report metrics and line numbers are rendered from bounded finite numeric values, preventing tampered local-history numeric fields from being interpolated as markup.
2. `test/reportSafety.test.ts` (new)
   - Adds eight checks for escaped untrusted report content, hostile numeric values, honest validation status, and accurate local-transmission wording. Added to the normal test command.

### Verification actually run
- Report safety regression: **8/8 assertions passed** in an isolated Node harness.
- Previous local-analysis accuracy suite: **13/13 passed**; context analyzer suite: **26/26 passed**.
- TypeScript syntax scan after all changes: **54 TS/TSX files, zero syntax diagnostics**. `npm test` remains blocked (`tsx` is not installed); `npm run lint` and `npm run build` remain blocked by missing `vite/client` and `vite`.

### Remaining limits
- Markdown report prose and code blocks are intended as text artifacts; this batch specifically hardens the HTML report's untrusted text and numeric interpolation and corrects inaccurate report claims. A complete Markdown renderer-specific sanitization policy has not been implemented.

## 12. Detection precision: prevent unrelated sanitizers from hiding findings

- Replaced broad nearby-context auto-suppression for SQL, path traversal, command injection, deserialization, weak PRNG, and XSS with a conservative policy. A nearby `prepare()`, `basename()`, `JSON.parse()`, `ObjectInputFilter`, CSPRNG call, or encoder no longer proves that the candidate value is protected.
- Added a narrow XSS exception only when the same request-derived variable is visibly assigned through an HTML sanitizer and then referenced on the candidate output line, or the request expression is directly wrapped at that output. This avoids suppressing a sink because a different variable was encoded nearby.
- Added `test/sanitizationPrecision.test.ts` with unrelated-control, plausible-control, and same-value XSS cases. The current bounded regex engine deliberately leaves other uncertain controls visible for review rather than claiming they are safe.
- Synthetic evaluation: 13/13 cases passed, 0 false positives, 0 false negatives; reported precision/recall/F1/accuracy all 100% on this small suite only. This is not a general guarantee and does not establish real-world detector accuracy.
- Focused tests: sanitization precision 18 assertions; context analyzer 26 assertions; report safety 8 assertions.
- Full project `npm test`, lint, and build remain blocked by missing local dependencies (`tsx`, `vite` / `vite/client`); no network install was attempted.

## Local source-to-sink precision and recovery of blocked checks — 12 November 2026 (continued)

### Detection changes
- Replaced generic taint-name matching (`username`, `filename`, `url`, `target_host`, `rawPayload`, etc.) with recognized external-input expressions such as request parameters, query APIs, process arguments, and prompt/input functions.
- The local heuristic now elevates a candidate to `LIKELY` only when a recognized source is assigned to a variable that the sink line references in the visible local context, or the source expression is directly present at the sink.
- A reassignment between the source assignment and sink invalidates the local indicator. A source assigned to a different variable does not elevate the candidate.
- Unknown function parameters such as `rawPayload` no longer count as proof of user control. The Java deserialization fixture is now correctly classified `NEEDS_REVIEW` pending caller/source tracing.
- Updated the comment/sink regression: a sink using a generic variable name without a recognized source remains `NEEDS_REVIEW`.
- Added synthetic SQL regressions for unrelated source variables, same-variable local source-to-sink indicators, and intervening reassignment.

### Verification actually run
- Accuracy suite: **13/13 cases passed**, 0 false positives / 0 false negatives on this hand-authored fixture set; ambiguous Java deserialization is kept as `NEEDS_REVIEW`.
- Sanitization precision: **22 assertions passed** (18 previous assertions + 4 source-to-sink regressions).
- Context analyzer regression: **26/26 assertions passed**.
- TypeScript syntax transpilation using the globally available TypeScript compiler: **56 TS/TSX files, zero syntax diagnostics**.
- Manually executed the 19 configured test files using the globally available `ts-node` transpile-only runner: **15 passed; 4 could not complete**. Blockers: `jszip` missing for upload tests; `@google/genai` missing for provider tests; authentication-boundary test requires the local server on `127.0.0.1:3000`, which could not start without Express dependencies.
- Attempted `npm install --no-audit --no-fund`; it timed out. A direct npm registry probe returned DNS `EAI_AGAIN` for `registry.npmjs.org`; no packages were installed and no package manifest/lockfile changes were made.
- Global `tsc --noEmit` remains blocked by missing `vite/client` type definitions. Vite production build remains unavailable because the project-local Vite package is not installed; the no-install invocation did not complete in this network-restricted environment.

### Limits
- This is still bounded, same-file heuristic tracking, not a parser-backed AST/CFG or interprocedural taint engine. Aliasing, destructuring, complex expressions, closures, object properties, framework wrappers, and cross-file calls remain outside the proof model.
- The 13-case fixture score is not a real-world accuracy guarantee. Keep findings as `LIKELY` or `NEEDS_REVIEW`, never `CONFIRMED`, until independently verified.
- No live targets or remote AI providers were contacted; tests use synthetic source only.

## Phase 1 foundation audit and hardening — 12 November 2026

### Scope

Worked only on the local-host foundation: architecture boundaries, runtime configuration, and source-ingestion safety. No public hosting or multi-user functionality was added.

### Changes made

1. **Project identity and runtime contract**
   - Renamed the package from the starter-template name `react-example` to `patchproof`, set version `0.1.0`, declared Node.js `>=20.19.0`, and pinned the working Node version in `.nvmrc` to `22.16.0`.
   - Added an explicit `typecheck` script and included the new foundation regression tests in `npm test`.
   - Updated the Bun lockfile workspace name to match the package manifest.
2. **Runtime listener validation**
   - Added `src/utils/runtimeConfig.ts` to validate the listener host and port before server startup.
   - Rejects non-loopback hosts, malformed ports, port zero, and ports outside 1–65535; no silent fallback for an explicitly empty `PORT`.
   - Added clear listener startup errors for address-in-use and permission failures.
3. **Local API hardening**
   - Disabled Express `X-Powered-By` and explicitly disabled proxy trust.
   - Restricted WebSocket CSP connections to loopback hostnames instead of the broad `ws:` scheme.
4. **Single-file ingestion**
   - Added `sanitizeSingleFileName`; single-file analysis keeps only a supported, safe leaf filename and rejects unsupported extensions/control characters.
   - Client-supplied language labels are allowlisted; invalid values fall back to server-side language detection.
5. **ZIP and path ingestion**
   - Added a 5,000-entry ZIP metadata cap, including unsupported/skipped entries.
   - Relative paths now reject control characters, overlong paths, empty path segments, and ambiguous repeated separators in addition to traversal and absolute paths.
6. **Architecture and acceptance documentation**
   - Added `docs/ARCHITECTURE.md` and `docs/FOUNDATION_ACCEPTANCE.md`.
   - Rewrote the README with accurate local-only setup, trust boundaries, limitations, and verification commands.

### Verification actually run

- Runtime configuration: **17/17** isolated assertions passed.
- Local host/origin policy: **25/25** isolated assertions passed.
- Single-file filename and relative-path policy: **23/23** isolated assertions passed.
- TypeScript/TSX transpile syntax scan: **59 files, 0 syntax diagnostics**.

### Verification blocked

- `npm install --no-audit --no-fund --prefer-online` timed out; npm registry requests in the install log failed with `EAI_AGAIN` (DNS/network resolution). No dependency installation completed.
- `npm test` is blocked because `tsx` is not installed.
- `npm run typecheck` is blocked because `vite/client` type definitions are unavailable.
- `npm run build` is blocked because Vite is not installed.
- The ZIP/folder integration suite and upload-to-analysis end-to-end smoke test were not run because project dependencies are absent.

### Phase 1 status

Implementation and documentation gaps found in the foundation audit were addressed. Phase 1 is **not accepted as 100% complete yet**: dependency-backed tests, full typecheck, production build, and a running local upload smoke test remain mandatory gates. Do not mark the phase complete until those gates pass.


## Independent completion batches — 12 November 2026

### Batch 1 — API route boundary regression
- Added `test/apiRouteBoundary.test.mjs` to audit every API mutation route for session authentication, every GET route against the explicit public-read allowlist, and expensive provider/analysis routes for the shared concurrency gate.
- Added the regression to the default test command and the focused security command.
- Latest full app-validation run checked **18 mutation routes, 7 API GET routes, and 10 expensive routes**.

### Batch 2 — DNS-pinned provider transport regression
- Expanded pinned DNS tests to reject mixed public/private DNS answer sets, mismatched address-family metadata, and documentation IPv4 addresses.
- The rule remains fail-closed: every answer in a resolved set must be a valid public address.

### Batch 3 — Responsive readability correction
- Increased the minimum code/technical typography from 0.72rem (11.52px) to 0.75rem (12px).
- Added a responsive-layout regression assertion for the minimum size. This is a source-level CSS check; it does not replace real-device readability testing.

### Batch 4 — Verification integration
- Included the API route boundary regression in both the full and focused security test commands.
- GitHub Actions run [43301370687](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43301370687) passed both application validation and repository preflight. Application validation completed TypeScript type-check, production build, local server startup, and the complete configured regression suite.
- GitHub Actions run [43301370428](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43301370428) passed the lockfile workflow.

### Batch 5 — Documentation and release-state accuracy
- Reconciled the source-archive comparison records: the earlier 57-match / 25-conflict figure is historical; the latest CI audit of 82 archive paths reports **36 exact matches, 46 preserved conflicts, and 0 missing paths**.
- No differing archive file was overwritten. The old 25-path disposition list is explicitly marked as a historical baseline, not a complete list of current conflicts.
- Kept the release decision unchanged: no merge to `main`, no public deployment, and no release-readiness claim. Browser/device smoke testing, live DNS/TLS integration on supported environments, semantic review of archive conflicts, and real-world detection evaluation remain open.

### Final verification boundary
CI passing is reproducible automated evidence for the checked commit; it is not a penetration-test certification, does not prove zero vulnerabilities, and does not complete manual PC/Android acceptance.
