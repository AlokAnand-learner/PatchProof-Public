# PatchProof Development Roadmap

## Current repository state

The public development repository is being populated on the isolated working branch `work/ssrf-special-purpose-ipv4-2026-11-12`. The reviewed source archive contains 82 files (868,355 uncompressed bytes). A read-only comparison now accounts for all 82 paths: 57 match exactly, 25 differ from the reviewed archive and are preserved, and none are missing. This is a source-transfer measure only, not a product-readiness percentage.

The branch contains a hash-pinned archive importer, an automatic import workflow, and a read-only conflict-audit workflow. The uploaded archive has been imported; differing branch files are preserved rather than overwritten and are listed by the audit for reconciliation.

## Phase progress snapshot

These percentages are engineering estimates, not test coverage or acceptance percentages. No phase is marked complete until its acceptance gates pass.

| Phase | Progress | Current state |
|---|---:|---|
| 1. Safe source import | 75% | All 82 paths accounted for; 57 exact matches and 25 preserved differences; final conflict review and runtime smoke test remain |
| 2. Reproducible setup | 75% | Frozen install, typecheck, production build, and full test suite pass in CI; one postinstall warning is still being investigated |
| 3. Detection precision | 45% | Alias propagation/reassignment regressions cover SQL, command, and URL-fetch sinks; empty positive-class metrics no longer report artificial 100% precision/recall; benchmark remains small and synthetic |
| 4. Upload/archive safety | 82% | ZIP/folder and server-backed upload-to-analysis tests pass; all provider request branches use the source boundary; contract, prompt-injection, and remote credential-redaction tests added |
| 5. Privacy/local boundary | 72% | Local-only boundary, consent, privacy defaults, remote-source credential redaction, redirect rejection, and DNS-pinned custom HTTPS requests are implemented and regression-tested |
| 6. UX/release readiness | 52% | Reduced-motion support, modal keyboard focus trapping/restoration, and 44px mobile navigation targets are implemented and regression-tested; real-device browser smoke remains |

## Phase 1 — Safe source import

**Progress: 75% engineering estimate. All 82 archive paths are accounted for (57 exact matches, 25 preserved differences, no missing paths); acceptance remains incomplete.**

Completed:
- Imported or recreated project configuration, Node version pin, Vite/TypeScript setup, example-only environment template, metadata, entrypoint, and visual assets.
- Added or imported local Host/Origin validation, bounded provider response handling, model-name validation, request-error sanitization, SSRF endpoint validation, and AI finding trust-boundary checks, and production CSP without `unsafe-eval`.
- Added a guarded source archive importer with strict path, symlink, size, compression-ratio, UTF-8, and high-confidence secret-pattern checks, including AWS, GitHub, Google, Stripe, Slack, GitLab, npm, and private-key patterns.
- Added a provider-neutral untrusted-source boundary helper: it separates a fixed defensive system instruction from JSON-encoded source data, enforces file/path/size limits, and flags common prompt-injection-like text without deleting source content. This helper is not yet wired into provider adapters.
- Expanded ZIP collision checks to include implicit parent directories and cross-platform case/Unicode aliases.
- Pinned the importer to the reviewed archive SHA-256: `f6a0cbe3ab7e1fc0c1c8ab33ad3218ad903ac65a1fc5267342b6cd642c9770b5`.
- Added a GitHub Actions workflow that imports missing files and removes the temporary archive after a successful import.
- Updated the handoff instructions for the 82-file archive. The archive import completed with 41 new files; subsequent read-only audit found 57 exact matches, 25 differing preserved files, and no missing archive paths.
- Added an automated read-only conflict audit that downloads the exact SHA-pinned archive from its upload commit and compares hashes without overwriting files.

Still required:
- Review the 25 preserved differences against the source archive and keep the more secure branch versions where appropriate; do not blindly replace them with the older archive copy.
- Complete an end-to-end upload-to-analysis smoke test in a real browser and review any remaining conflicts.

## Phase 2 — Reproducible project setup

Completed:
- Node.js 22.16.0 is pinned in `.nvmrc`; the manifest requires Node.js 20.19 or later.
- Bun is selected as the package manager; a 307-package `bun.lock` is committed on the working branch.
- Development, production start, build, typecheck, full test, and focused security test scripts are defined.
- GitHub Actions generated the lockfile from the current manifest and successfully completed `bun install --frozen-lockfile`.
- A dedicated workflow regenerates and verifies the lockfile when the package manifest changes.

Still required:
- Review the dependency lifecycle script reported as blocked by Bun; do not approve install scripts without checking why they are needed.
- Bun identifies the blocked lifecycle script as `protobufjs@7.6.6` (`node scripts/postinstall`). It remains blocked; `bun pm untrusted` lists it after installation. Typecheck, build, and tests pass without running it, so do not add it to trusted dependencies unless its necessity is established.
- Verify a clean checkout and local runtime startup on a developer machine.

## Phase 3 — Detection precision

Completed:
- Added bounded propagation through simple identifier aliases, with reassignment invalidating taint.
- Expanded the local context lookback to five preceding lines while keeping analysis bounded.
- Test, sample, and documentation findings with source-to-sink indicators remain visible as informational `NEEDS_REVIEW` items rather than likely production vulnerabilities; they do not reduce the production score.
- Reworked benchmark accounting so review-only cases are excluded from binary precision/recall calculations.
- Added alias propagation and reassignment regression cases for SQL, command-execution, and URL-fetch sinks.
- Empty precision/recall denominators now return conservative zero values rather than an artificial perfect score; a dedicated edge-case test covers this.
- AI-generated findings are deduplicated by normalized title, CWE, and exact source line range; snippets continue to be derived from source rather than accepted from model output.\n- Untrusted model-supplied labels and prose have non-printing control and bidirectional formatting characters removed; CWE identifiers are constrained to a recognized `CWE-<number>` or `CWE-Other` form.
- The built-in suite has 13 synthetic fixtures: 9 binary-scored cases and 4 review-only cases. The latest focused run produced 3 TP, 6 TN, 0 FP, and 0 FN for the 9 scored fixtures.

Limitations:
- These percentages describe a small synthetic suite, not real-world accuracy. They are not evidence of zero false positives or complete detection.
- Full AST, control-flow, interprocedural taint, framework-aware sanitizer, and broader language coverage remain future work.
- Add larger independently labelled positive and negative corpora before drawing meaningful accuracy conclusions.

## Phase 4 — Upload and archive safety

**Progress: 60% (engineering estimate; integration gates remain open).**

Completed:
- ZIP and folder ingestion are in-memory; uploaded source is not written to disk or executed.
- Added strict cross-platform path checks for traversal, absolute paths, ambiguous whitespace/dot segments, reserved Windows device names, and invalid filename characters.
- Added case/Unicode-collision rejection for folder uploads and ZIP entry paths.
- Per-file, total extracted size, archive size, entry-count, file-count, symlink, and binary-content checks are present.
- The reviewed-archive importer enforces UTF-8, bounded actual decompression, compression-ratio limits, safe portable names, and file/directory collision rejection.
- High-confidence credential patterns include private keys and AWS, GitHub, Google, Stripe, Slack, GitLab, and npm tokens.
- A separate untrusted-source AI boundary helper serializes source as JSON data, provides a fixed defensive system instruction, applies path/file/total limits, and flags common prompt-injection indicators. It deliberately preserves source text and does not claim heuristic detection is complete.

Still required:
- The fixed system instruction and separate JSON source payload are now wired into Ollama, Gemini, OpenAI-compatible, and Anthropic request branches. No tool declarations are sent by these review requests.
- JSZip-backed ZIP/folder tests pass in the complete suite; malformed archives, duplicate entries, path collisions, and decompression limits have regression coverage.
- Local Ollama/custom and remote custom payload-preparation tests verify the source boundary, absence of tool declarations, redirect rejection, and credential redaction. Provider adapter source-contract tests cover all four provider request shapes. Hosted Gemini/Anthropic requests have not been exercised against live credentials.
- Complete a real-browser upload-to-analysis smoke test and inspect memory use under configured limits.

## Phase 5 — Privacy and local boundary

Completed:
- Loopback-only listener configuration, Host and Origin validation, disabled proxy trust, rate limiting, pre-body authentication, and bounded JSON parsing are present.
- SSRF validation blocks private, loopback, link-local, metadata, special-purpose IPv4, and restricted IPv6 destinations; special-purpose IPv6 coverage now explicitly rejects deprecated site-local, documentation, Teredo, 6to4, and NAT64 translation prefixes. Trusted local providers are restricted to loopback and allowed ports.
- Remote provider transmission requires explicit server-side consent; local Ollama/custom loopback use does not require cloud consent. Provider connection tests enforce the same consent and offline-mode gates. Connection tests now enforce the same consent and offline-mode gates.
- Privacy mode is enabled by default and removes full source and full-file patches from browser history.
- History clear now reports success or failure rather than silently claiming success. Production CSP no longer permits `unsafe-eval`. Production CSP no longer permits `unsafe-eval`.

Still required:
- Run live network integration checks for DNS-pinned custom endpoints and confirm certificate/hostname validation across supported operating systems.
- Verify all provider adapters enforce equivalent timeouts, response bounds, redirect policy, and credential redaction. Remote custom HTTPS requests now pin validated DNS answers and reject restricted address sets; redirects are not followed.
- Review all logs, reports, browser persistence, and error paths after full application import.

## Phase 6 — UX and release readiness

Approved design requirements to integrate after full source import: preserve the user-selected original PatchProof logo; support approved liquid-glass light and midnight dark themes; provide dedicated responsive layouts across display sizes and aspect ratios; adapt immediately to portrait/landscape rotation, browser resizing, and split-screen without reload; and include keyboard/touch accessibility and reduced-motion support.

Completed:
- Responsive layout regression checks pass.
- Benchmark UI now shows scored versus review-only fixtures and labels the synthetic nature of its metrics.
- Removed controls that were stored but did not affect the analysis engine; replaced them with a transparent description of actual policy.
- History clearing now has explicit success/failure feedback.
- The settings and analysis screens disclose that browser localStorage is not encrypted and that remote AI transmission requires consent.

Still required:
- Run the application in a real browser and verify upload, analysis, provider selection, reports, history, clear-history, mobile layout, and error recovery.
- Verify empty, loading, and failure states on Android-sized viewports.
- Mobile navigation moves focus into the drawer, traps forward/reverse Tab, closes on Escape, and restores prior focus. Bottom navigation controls have a minimum 44px touch target. Global reduced-motion support is implemented and regression-tested.
- Complete screen-reader and color-contrast review; automated source-level checks do not replace assistive-technology testing.
- Keep public deployment disabled until a separate deployment threat model and security review are complete.

## Verification performed in this work session

- Latest full GitHub Actions run passed the Python repository/archive preflight (43 tests), type-check, production build, local server startup, and complete Node regression suite. Provider boundary tests include 22 assertions, provider adapter contract tests 16, source boundary tests 17, pinned DNS tests 10, and mobile layout/accessibility tests 14. The read-only archive comparison reports 57 exact matches, 25 preserved differences, and no missing paths.
- Earlier foundation audit: 21 of the 23 scripted test files were executed successfully in focused mode.
- The latest focused workflow passed 40 Python repository/archive tests, 10 same-origin API tests, 13 untrusted-source boundary checks, 18 AI-finding validation checks, 10 special-purpose IPv4 checks, and 8 special-purpose IPv6 checks (102 reported checks across the focused groups).
- The complete suite now includes JSZip-backed upload safety and server-backed authentication boundary tests; both pass in CI.
- TypeScript type-check and production build pass after the reviewed source import.
- A single postinstall warning remains under investigation; the explicit `bun pm untrusted` audit reports zero untrusted dependencies.
- A real-device browser smoke test remains unverified because the app is not running on the user's local device.

## Manual verification still required

- Open the app on the user's Android device and verify the real file/folder picker, upload, navigation, orientation changes, and small-screen layout. GitHub-hosted CI cannot inspect the user's device or local browser.
- Live Gemini/Anthropic provider calls require the user's own approved credentials and explicit cloud consent; request-shape tests pass without sending source to hosted services.

## Acceptance rule

A phase is complete only when its implementation is present in the repository and its relevant automated tests pass. A source-level inspection, isolated test, syntax transpilation, or archive-path percentage is not a substitute for a complete application build, full test suite, and runtime smoke test.
