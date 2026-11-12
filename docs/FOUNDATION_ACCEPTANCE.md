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
- [ ] Dependencies installed from the declared manifest.
- [ ] Full TypeScript typecheck passes.
- [ ] Production build passes.
- [ ] Full test suite passes.

## Source ingestion
- [x] ZIP and folder uploads preserve relative paths and reject traversal, absolute paths, ambiguous separators, and control characters.
- [x] ZIP extraction is in-memory only; symlinks and unsupported/binary files are rejected.
- [x] Per-file, archive-size, ZIP-entry-count, project-size, and file-count limits exist.
- [x] Server independently validates multi-file project paths and content.
- [x] Single-file labels are reduced to safe supported filenames; client language labels are allowlisted.
- [ ] Dependency-backed ZIP/folder upload suite passes in the complete project environment.
- [ ] End-to-end upload-to-analysis smoke test passes in a running local application.

## Phase 1 completion rule
Do not mark Phase 1 as 100% while any unchecked verification item remains. Source-level implementation is not equivalent to a successful build or runtime test.

## Cross-platform developer workflow
- [x] Development and production startup explicitly select their runtime modes without shell-specific environment syntax.
- [x] Clean script uses Node.js filesystem APIs and is cross-platform.
- [ ] A single package manager and matching committed lockfile are selected and verified.
