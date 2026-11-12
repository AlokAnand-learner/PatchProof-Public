# PatchProof Development Roadmap

## Current repository state

The public repository contains a controlled partial import of the reviewed local source archive. The import branch is not yet a runnable application. The reviewed archive contains 79 files; 40 have been transferred into this branch so far. This file-count measure is not a completion claim for the application itself: key runtime, UI, analysis, and upload modules remain to be imported.

## Phase 1 — Safe source import

**Progress: approximately 50% of archive entries transferred; phase acceptance remains incomplete.**

Imported so far:
- Project manifest, TypeScript/Vite configuration, Node version pin, ignore rules, and example-only environment template.
- Local-first architecture and foundation acceptance documentation.
- Loopback host/origin validation, runtime configuration, bounded provider-response handling, model-name validation, request-error mapping, local authenticated API helper, and SSRF endpoint validation.
- Security domain types and AI finding validation boundary.
- Focused regression tests for runtime configuration, host/origin policy, model names, request errors, bounded provider responses, AI finding validation, SSRF special-purpose IPv4 boundaries, filename/path policy, middleware ordering, report safety, consent, context classification, ReDoS boundaries, and evaluation.
- HTML entrypoint, React entrypoint, metadata, and logo assets.

Still required:
- Core server and the remaining UI, components, styles, analysis engine, provider engine, archive ingestion, persistence, and report implementation files.
- Remaining tests and source fixtures.
- The reviewed lockfile and a complete file-by-file import audit.
- Secret and artifact review across the complete imported tree.

The import branch deliberately remains separate from `main`.

## Phase 2 — Reproducible project setup

- Finalize the package-manager and lockfile strategy.
- Install dependencies in a network-capable environment.
- Run the complete test suite, TypeScript typecheck, and production build.
- Add a clean-checkout smoke test.

## Phase 3 — Detection precision

- Keep deterministic validation separate from AI-generated hypotheses.
- Validate source-to-sink paths and sanitization context before promoting a candidate finding.
- Add positive and negative regression fixtures for each supported detector.
- Track precision, recall, false-positive rate, and false-negative examples; never claim zero false positives.

## Phase 4 — Upload and archive safety

- Enforce archive entry-count, decompressed-size, path traversal, filename, and supported-language limits.
- Treat uploaded source and archive metadata as untrusted data.
- Never execute uploaded code during analysis.
- Add regression tests for malformed archives and platform-specific path forms.

## Phase 5 — Privacy and local boundary

- Keep localhost-only binding and strict Host/Origin checks.
- Keep remote AI opt-in and require explicit consent before source transmission.
- Make privacy behavior and local-storage limitations clear in the UI.
- Verify that logs and reports do not leak secrets or full source unintentionally.

## Phase 6 — UX and release readiness

- Verify responsive layouts, empty states, loading states, and error recovery.
- Test upload, analysis, report generation, history, and clear-history workflows.
- Document known limitations and supported languages.
- Do not publish a hosted deployment until a separate threat model and deployment security review are complete.

## Acceptance rule

A phase is complete only when its implementation is present in the repository and its relevant automated tests pass. A source-level inspection or isolated test is not a substitute for the full application test suite. No full application build, complete typecheck, or full test-suite result is claimed at this stage.
