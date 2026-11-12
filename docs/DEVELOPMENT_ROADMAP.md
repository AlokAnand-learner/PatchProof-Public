# PatchProof Development Roadmap

## Current repository state

The public development repository is being populated on the isolated working branch `work/ssrf-special-purpose-ipv4-2026-11-12`. The reviewed source archive contains 82 files (868,355 uncompressed bytes). A read-only comparison now accounts for all 82 paths: 57 match exactly, 25 differ from the reviewed archive and are preserved, and none are missing. This is a source-transfer measure only, not a product-readiness percentage.

The branch contains a hash-pinned archive importer, an automatic import workflow, and a read-only conflict-audit workflow. The uploaded archive has been imported; differing branch files are preserved rather than overwritten and are listed by the audit for reconciliation.

## Phase progress snapshot

These percentages are engineering estimates, not test coverage or acceptance percentages. No phase is marked complete until its acceptance gates pass.

| Phase | Progress | Current state |
|---|---:|---|
| 1. Safe source import | 75% | All 82 paths accounted for; 57 exact matches and 25 preserved differences; final conflict review and runtime smoke test remain |
| 2. Reproducible setup | 75% | Frozen install, typecheck, production build, local server startup, and full Node test suite pass in CI; the `protobufjs` lifecycle script remains intentionally blocked pending review |
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
- Added a provider-neutral untrusted-source boundary helper and wired it into Ollama, Gemini/Gemma, OpenAI-compatible, and Anthropic request branches. It separates a fixed defensive system instruction from JSON-encoded source data, enforces file/path/size limits, and flags common prompt-injection-like text without deleting source content.
- Expanded ZIP collision checks to include implicit parent directories and cross-platform case/Unicode aliases.
- Pinned the importer to the reviewed archive SHA-256: `f6a0cbe3ab7e1fc0c1c8ab33ad3218ad903ac65a1fc5267342b6cd642c9770b5`.
- Added a GitHub Actions workflow that imports missing files and removes the temporary archive after a successful import.
- Updated the handoff instructions for the 82-file archive. The archive import completed with 41 new files; subsequent read-only audit found 57 exact matches, 25 differing preserved files, and no missing archive paths.
- Added an automated read-only conflict audit that downloads the exact SHA-pinned archive from its upload commit and compares hashes without overwriting files.

Still required:
- Complete a line-by-line review of the 25 preserved differences against the reviewed source archive; the current reconciliation is path/hash-level and records affected files, not a full semantic diff review. Keep more secure branch versions where appropriate; do not blindly replace them with older archive copies.
- Complete an end-to-end upload-to-analysis smoke test in a real browser and review any remaining conflicts.

## Phase 2 — Reproducible project setup

Completed:
- Node.js 22.16.0 is pinned in `.nvmrc`; the manifest requires Node.js 20.19 or later.
- Bun is selected as the package manager; a 307-package `bun.lock` is committed on the working branch.
- Development, production start, build, typecheck, full test, and focused security test scripts are defined.
- GitHub Actions generated the lockfile from the current manifest and successfully completed `bun install --frozen-lockfile`.
- A dedicated workflow regenerates and verifies the lockfile when the package manifest changes.

Still required:
- Keep the `protobufjs@7.6.6` (`node scripts/postinstall`) lifecycle script blocked until its purpose and necessity are independently established. Do not approve it merely to silence a warning.
- Verify a clean checkout, frozen install, and local runtime startup on a developer machine. CI does not replace a clean local-machine check.

## Phase 3 — Detection precision

Completed:
- Added bounded propagation through simple identifier aliases, with reassignment invalidating taint.
- Expanded the local context lookback to five preceding lines while keeping analysis bounded.
- Test, sample, and documentation findings with source-to-sink indicators remain visible as informational `NEEDS_REVIEW` items rather than likely production vulnerabilities; they do not reduce the production score.
- Reworked benchmark accounting so review-only cases are excluded from binary precision/recall calculations.
- Added alias propagation and reassignment regression cases for SQL, command-execution, and URL-fetch sinks.
- Empty precision/recall denominators and entirely empty evaluation suites now return conservative zero metrics rather than artificial perfect scores; dedicated edge-case tests cover both.
- AI-generated findings are deduplicated by normalized title, CWE, and exact source line range; snippets continue to be derived from source rather than accepted from model output.\n- Untrusted model-supplied labels and prose have non-printing control and bidirectional formatting characters removed; CWE identifiers are constrained to a recognized `CWE-<number>` or `CWE-Other` form.
- The built-in suite has 13 synthetic fixtures: 9 binary-scored cases and 4 review-only cases. The latest successful focused run produced 3 TP, 6 TN, 0 FP, and 0 FN for the 9 scored fixtures; the empty-suite metric regression passes CI.

Limitations:
- These percentages describe a small synthetic suite, not real-world accuracy. They are not evidence of zero false positives or complete detection.
- Full AST, control-flow, interprocedural taint, framework-aware sanitizer, and broader language coverage remain future work.
- Add larger independently labelled positive and negative corpora before drawing meaningful accuracy conclusions.

## Phase 4 — Upload and archive safety

**Progress: 82% engineering estimate; integration gates remain open.**

Completed:
- ZIP and folder ingestion are in-memory; uploaded source is not written to disk or executed.
- Added strict cross-platform path checks for traversal, absolute paths, ambiguous whitespace/dot segments, reserved Windows device names, and invalid filename characters.
- Added case/Unicode-collision rejection for folder uploads and ZIP entry paths.
- Per-file, total extracted size, archive size, entry-count, file-count, symlink, and binary-content checks are present.
- The reviewed-archive importer enforces UTF-8, bounded actual decompression, compression-ratio limits, safe portable names, and file/directory collision rejection.
- High-confidence credential patterns include private keys and AWS, GitHub, Google, Stripe, Slack, GitLab, and npm tokens.
- A separate untrusted-source AI boundary helper serializes source as JSON data, provides a fixed defensive system instruction, applies path/file/total limits, and flags common prompt-injection indicators. It deliberately preserves source text and does not claim heuristic detection is complete.

Completed:
- The fixed system instruction and separate JSON source payload are wired into Ollama, Gemini/Gemma, OpenAI-compatible, and Anthropic request branches. No tool declarations are sent by these review requests.
- JSZip-backed ZIP/folder tests pass in the complete suite; malformed archives, duplicate entries, path collisions, and decompression limits have regression coverage.
- Local Ollama/custom and remote custom payload-preparation tests verify the source boundary, absence of tool declarations, redirect rejection, and credential redaction. Provider adapter source-contract tests cover all four provider request shapes.

Still required:
- Real-browser upload-to-analysis smoke test and memory-use inspection under configured limits.
- Hosted Gemini/Anthropic provider-specific mock/live integration; live calls require credentials and explicit consent and are optional for local-only acceptance.

## Phase 5 — Privacy and local boundary

Completed:
- Loopback-only listener configuration, Host and Origin validation, disabled proxy trust, rate limiting, pre-body authentication, and bounded JSON parsing are present.
- SSRF validation blocks private, loopback, link-local, metadata, special-purpose IPv4, and restricted IPv6 destinations; special-purpose IPv6 coverage now explicitly rejects deprecated site-local, documentation, Teredo, 6to4, and NAT64 translation prefixes. Trusted local providers are restricted to loopback and allowed ports.
- Remote provider transmission requires explicit server-side consent; local Ollama/custom loopback use does not require cloud consent. Provider connection tests enforce the same consent and offline-mode gates.
- Privacy mode is enabled by default and removes full source and full-file patches from browser history.
- History clear now reports success or failure rather than silently claiming success. Production CSP no longer permits `unsafe-eval`.

Still required:
- Verify DNS-pinned custom HTTPS transport against controlled integration endpoints and confirm certificate/hostname validation across supported operating systems. Source-level tests cover address validation and pinned lookup behavior, but do not prove live TLS/DNS behavior on every supported OS.
- Remote custom HTTPS requests pin validated DNS answers, reject restricted address sets, and do not follow redirects; audit equivalent timeout, response-bound, redirect, and redaction behavior across all providers.
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

- Latest full code-validation GitHub Actions run (commit `7009919e55b057aa7f134f3638f396dc5bfd9300`) passed both jobs: Python repository/archive preflight, type-check, production build, local server startup, and complete Node regression suite. The new empty-suite metric regression is included in that passing run. Provider boundary tests include 22 assertions, provider adapter contract tests 16, source boundary tests 17, pinned DNS tests 10, and mobile layout/accessibility tests 14. The read-only archive comparison reports 57 exact matches, 25 preserved differences, and no missing paths.
- Earlier foundation audit: 21 of the 23 scripted test files were executed successfully in focused mode.
- The latest focused workflow passed 40 Python repository/archive tests, 10 same-origin API tests, 13 untrusted-source boundary checks, 18 AI-finding validation checks, 10 special-purpose IPv4 checks, and 8 special-purpose IPv6 checks (102 reported checks across the focused groups).
- The complete suite now includes JSZip-backed upload safety and server-backed authentication boundary tests; both pass in CI.
- TypeScript type-check and production build pass after the reviewed source import.
- The `protobufjs@7.6.6` lifecycle script remains blocked pending a necessity review; do not approve it without evidence that the app requires it.
- The full CI suite does not verify the user's local runtime, real file picker, Android touch behavior, or assistive-technology behavior.

## Manual verification still required

- Open the app on the user's Windows PC and verify local startup, real file/folder picker, upload-to-analysis, reports, history, provider selection, and error recovery. The PC test is a manual acceptance gate.
- Android viewport and orientation checks can be prepared with browser emulation, but real Android touch, picker, and assistive-technology behavior still needs device verification.
- Live Gemini/Anthropic provider calls require approved credentials and explicit cloud consent; they are optional to the local-first release and must not block local-only acceptance.

## Acceptance rule

A phase is complete only when its implementation is present in the repository and its relevant automated tests pass. A source-level inspection, isolated test, syntax transpilation, or archive-path percentage is not a substitute for a complete application build, full test suite, and runtime smoke test.
