# PatchProof Development Roadmap

## Current repository state

The public development repository contains a partial source import on the isolated working branch. It is not yet a runnable application. The reviewed source archive contains 79 files (858,868 uncompressed bytes). At the latest audit, 39 of its 79 paths were already represented in the working branch (49.4% by archive path count); five additional branch-only files are tooling, documentation, or separately prepared regression material.

## Phase 1 — Safe source import

**Progress: 49% by source-archive path count. Acceptance remains incomplete.**

Completed:
- Imported or recreated the project manifest, Node version pin, TypeScript/Vite configuration, example-only environment template, entrypoint metadata, and visual assets.
- Added loopback Host/Origin validation, bounded provider response handling, model-name validation, request-error sanitization, SSRF endpoint validation, and an AI finding trust boundary.
- Added focused regression coverage for the security boundaries above.
- Added a guarded source-archive importer and GitHub Actions workflow on this working branch.
- Pinned the importer to the reviewed archive's SHA-256: `1c359f76a577537f7ed832503860a17e9c1a129dd3d43856441e2d3ac634e480`.
- Locally validated all 79 archive entries; path traversal and realistic credential patterns are rejected, symlinks and oversized entries are blocked, and existing branch files are never overwritten.

Still required:
- Upload the exact reviewed archive to `import/PatchProof-source.zip` on branch `work/ssrf-special-purpose-ipv4-2026-11-12`. The workflow then validates it and imports missing source files automatically.
- Review any existing-file conflicts reported by the importer; it preserves these files rather than overwriting branch work.
- Audit the complete resulting tree, finalize lockfile/package-manager alignment, and verify the import against the source archive.
- Run dependency installation, full typecheck, production build, complete tests, and a local smoke test.

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
