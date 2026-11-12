# Phase 1 — Foundation acceptance checklist

Phase 1 is complete only when all items below are implemented and verified.

## Architecture and scope
- [x] Local-first, single-user operating boundary is explicit.
- [x] UI, API, analysis, provider, input, and persistence boundaries are documented.
- [x] Public SaaS concerns are explicitly deferred rather than partially enabled.
- [x] Untrusted input and AI-output trust boundaries are documented.

## Runtime and developer setup
- [x] Node.js minimum version is declared.
- [x] Package identity is PatchProof rather than a starter-template name.
- [x] Development, production start, build, typecheck, and test commands are defined.
- [x] Host and port are validated before listening; only loopback hosts are accepted.
- [x] Proxy trust is disabled and Express identifies itself as little as practical.
- [x] Production Content Security Policy excludes `unsafe-eval`; development-only allowances are gated by runtime mode.
- [x] Dependencies installed from the declared manifest with the committed Bun lockfile.
- [x] Full TypeScript typecheck passes in GitHub Actions.
- [x] Production build passes in GitHub Actions.
- [x] Full test suite passes in GitHub Actions, including server-backed and JSZip-backed tests.

## Source ingestion
- [x] ZIP and folder uploads preserve relative paths and reject traversal, absolute paths, ambiguous separators, control characters, and cross-platform path aliases.
- [x] ZIP extraction is in-memory only; symlinks and unsupported/binary files are rejected.
- [x] Per-file, archive-size, ZIP-entry-count, project-size, and file-count limits exist.
- [x] Server independently validates multi-file project paths and content.
- [x] Single-file labels are reduced to safe supported filenames; client language labels are allowlisted.
- [x] Dependency-backed ZIP/folder upload suite passes in the complete project environment.
- [ ] End-to-end upload-to-analysis smoke test passes in a running local application.
- [x] AI source-boundary helper keeps uploaded source as JSON data separate from a fixed defensive system instruction, applies file/path/size limits, and flags common prompt-injection indicators without mutating the source.
- [x] Ollama, Gemini, OpenAI-compatible, and Anthropic request branches use the source boundary; no tool declarations are sent and uploaded source is not executed by PatchProof.
- [ ] Provider-specific request contract tests cover each provider branch, including hosted Gemini and Anthropic.
- [x] Local Ollama, local OpenAI-compatible, and mocked remote custom provider integration tests confirm prompt-injection-like source remains separate from system instructions and cannot add tool declarations.
- [ ] Hosted Gemini and Anthropic request contracts have not yet been exercised with provider-specific mocks or live credentials.
- [x] High-confidence credential patterns are redacted before any remote provider receives source; this is defense-in-depth, not a complete secret scanner.

## Phase 1 completion rule
Do not mark Phase 1 as 100% while any unchecked verification item remains. Source-level implementation is not equivalent to a successful build or runtime test.

## Cross-platform developer workflow
- [x] Development and production startup explicitly select their runtime modes without shell-specific environment syntax.
- [x] Clean script uses Node.js filesystem APIs and is cross-platform.
- [x] Bun is the single selected package manager; the committed `bun.lock` was verified with a frozen installation in GitHub Actions.
