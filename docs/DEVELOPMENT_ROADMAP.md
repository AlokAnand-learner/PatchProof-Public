# PatchProof Development Roadmap

## Current repository state

This repository is the public development home for PatchProof. The application source archive is being prepared for import; until that import is complete, this repository must not be treated as a runnable application.

## Phase 1 — Safe source import

- Import the complete, reviewed application source tree.
- Preserve the existing local-first architecture and localhost-only listener boundary.
- Exclude local environment files, credentials, dependency folders, build output, user data, and test artifacts.
- Verify that the imported tree matches the reviewed source archive.

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

A phase is complete only when its implementation is present in the repository and its relevant automated tests pass. A source-level inspection or isolated test is not a substitute for the full application test suite.
