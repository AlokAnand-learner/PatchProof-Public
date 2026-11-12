# PatchProof Development Roadmap

## Current repository state

The public development repository is being populated on the isolated working branch `work/ssrf-special-purpose-ipv4-2026-11-12`. The reviewed source archive contains 82 files (868,355 uncompressed bytes). At the latest audit, 40 of those 82 archive paths are represented in the working branch (49% by archive path count). This is a transfer measure only; it does not mean half of the product's functionality is release-ready.

The branch now contains a hash-pinned archive importer and GitHub Actions workflow. The updated reviewed archive is ready for the one-time upload described in [SOURCE_IMPORT_HANDOFF.md](SOURCE_IMPORT_HANDOFF.md). The importer adds missing files and preserves differing existing files for explicit reconciliation.

## Phase progress snapshot

These percentages are engineering estimates, not test coverage or acceptance percentages. No phase is marked complete until its acceptance gates pass.

| Phase | Progress | Current state |
|---|---:|---|
| 1. Safe source import | 49% | 40/82 archive paths represented; remaining source files await guarded import |
| 2. Reproducible setup | 30% | Node pin and scripts are present; Bun lockfile is absent and dependency installation/build/typecheck remain blocked |
| 3. Detection precision | 40% | Bounded alias taint and review-only fixture classification added; benchmark remains small and synthetic |
| 4. Upload/archive safety | 60% | Path normalization and collision checks added; dependency-backed ZIP suite still pending |
| 5. Privacy/local boundary | 60% | Local-only host/origin policy, SSRF controls, cloud consent, and privacy-default history are implemented |
| 6. UX/release readiness | 40% | Inert controls removed, history-clear result surfaced, benchmark disclosures improved; full app smoke test pending |

## Phase 1 — Safe source import

**Progress: 49% by source-archive path count. Acceptance remains incomplete.**

Completed:
- Imported or recreated project configuration, Node version pin, Vite/TypeScript setup, example-only environment template, metadata, entrypoint, and visual assets.
- Added or imported local Host/Origin validation, bounded provider response handling, model-name validation, request-error sanitization, SSRF endpoint validation, and AI finding trust-boundary checks, and production CSP without `unsafe-eval`.
- Added a guarded source archive importer with strict path, symlink, size, compression-ratio, UTF-8, and high-confidence secret-pattern checks, including AWS, GitHub, Google, Stripe, Slack, GitLab, npm, and private-key patterns.
- Added a provider-neutral untrusted-source boundary helper: it separates a fixed defensive system instruction from JSON-encoded source data, enforces file/path/size limits, and flags common prompt-injection-like text without deleting source content. This helper is not yet wired into provider adapters.
- Expanded ZIP collision checks to include implicit parent directories and cross-platform case/Unicode aliases.
- Pinned the importer to the reviewed archive SHA-256: `f6a0cbe3ab7e1fc0c1c8ab33ad3218ad903ac65a1fc5267342b6cd642c9770b5`.
- Added a GitHub Actions workflow that imports missing files and removes the temporary archive after a successful import.
- Updated the handoff instructions for the 82-file archive.

Still required:
- Upload the exact reviewed archive to `import/PatchProof-source.zip` on this working branch.
- Review importer conflict output; existing branch files with different contents are intentionally preserved.
- Audit the complete imported tree and resolve remaining conflicts.
- Run dependency installation, full typecheck, production build, complete test suite, and a local upload-to-analysis smoke test.

## Phase 2 — Reproducible project setup

Completed:
- Node.js 22.16.0 is pinned in `.nvmrc`; the manifest requires Node.js 20.19 or later.
- Bun is selected as the package manager; a matching committed `bun.lock` is still required.
- Development, production start, build, typecheck, and test scripts are defined.
- README documents the intended frozen-install command but explicitly marks it blocked until the lockfile is committed.

Still required:
- Generate and commit the Bun lockfile from the exact imported manifest in a network-capable environment.
- Install dependencies from that committed lockfile.
- Run full TypeScript typecheck and production build.
- Run all tests, including server-backed and JSZip-backed tests.
- Verify a clean checkout and local runtime startup.

## Phase 3 — Detection precision

Completed:
- Added bounded propagation through simple identifier aliases, with reassignment invalidating taint.
- Expanded the local context lookback to five preceding lines while keeping analysis bounded.
- Test, sample, and documentation findings with source-to-sink indicators remain visible as informational `NEEDS_REVIEW` items rather than likely production vulnerabilities; they do not reduce the production score.
- Reworked benchmark accounting so review-only cases are excluded from binary precision/recall calculations.
- The built-in suite has 13 synthetic fixtures: 9 binary-scored cases and 4 review-only cases. The latest focused run produced 3 TP, 6 TN, 0 FP, and 0 FN for the 9 scored fixtures.

Limitations:
- These percentages describe a small synthetic suite, not real-world accuracy. They are not evidence of zero false positives or complete detection.
- Full AST, control-flow, interprocedural taint, framework-aware sanitizer, and broader language coverage remain future work.
- Add larger independently labelled positive and negative corpora before drawing meaningful accuracy conclusions.

## Phase 4 — Upload and archive safety

Completed:
- ZIP and folder ingestion are in-memory; uploaded source is not written to disk or executed.
- Added strict cross-platform path checks for traversal, absolute paths, ambiguous whitespace/dot segments, reserved Windows device names, and invalid filename characters.
- Added case/Unicode-collision rejection for folder uploads and ZIP entry paths.
- Per-file, total extracted size, archive size, entry-count, file-count, symlink, and binary-content checks are present.

Still required:
- Wire the untrusted-source boundary into every AI provider adapter and verify uploaded content cannot grant tools, filesystem, or network access.
- Run the JSZip-backed ZIP/folder test suite after dependencies are installed.
- Add malformed-archive and duplicate-entry coverage using real JSZip fixtures.
- Run a complete upload-to-analysis integration smoke test and inspect memory use under configured limits.
- Verify prompt-injection fixtures against each supported model/provider with tool access disabled and secret redaction enforced.

## Phase 5 — Privacy and local boundary

Completed:
- Loopback-only listener configuration, Host and Origin validation, disabled proxy trust, rate limiting, pre-body authentication, and bounded JSON parsing are present.
- SSRF validation blocks private, loopback, link-local, metadata, special-purpose IPv4, and restricted IPv6 destinations; trusted local providers are restricted to loopback and allowed ports.
- Remote provider transmission requires explicit server-side consent; local Ollama/custom loopback use does not require cloud consent. Provider connection tests enforce the same consent and offline-mode gates. Connection tests now enforce the same consent and offline-mode gates.
- Privacy mode is enabled by default and removes full source and full-file patches from browser history.
- History clear now reports success or failure rather than silently claiming success. Production CSP no longer permits `unsafe-eval`. Production CSP no longer permits `unsafe-eval`.

Still required:
- Add DNS resolution/pinning protections for user-configured remote custom endpoints to reduce DNS-rebinding risk.
- Verify all provider adapters enforce equivalent timeouts, response bounds, redirect policy, and credential redaction.
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
- Complete keyboard/accessibility checks and document supported languages and known limitations.
- Keep public deployment disabled until a separate deployment threat model and security review are complete.

## Verification performed in this work session

- Latest focused GitHub Actions run passed 38 Python repository/archive tests, 10 same-origin API tests, and 10 untrusted-source boundary tests.
- Earlier foundation audit: 21 of the 23 scripted test files were executed successfully in focused mode.
- 311 focused assertions/cases passed across the executed test files.
- The two not completed were the JSZip-backed upload suite (dependency unavailable) and the server-backed authentication boundary suite (server/dependencies not running).
- TypeScript/TSX syntax transpilation completed for 62 files with zero syntax diagnostics.
- Full `tsc --noEmit` is blocked because project dependencies are not installed (`vite/client` is unavailable).
- Dependency installation timed out in the network-restricted environment; production build and full end-to-end smoke test were therefore not run.

## Acceptance rule

A phase is complete only when its implementation is present in the repository and its relevant automated tests pass. A source-level inspection, isolated test, syntax transpilation, or archive-path percentage is not a substitute for a complete application build, full test suite, and runtime smoke test.
