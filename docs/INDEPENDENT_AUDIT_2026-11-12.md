# Independent repository audit — 2026-11-12

## Scope and method

Read-only inspection of the public repository's development branch:
`work/ssrf-special-purpose-ipv4-2026-11-12`

Audited the branch tree, package manifest, README, architecture, roadmap, foundation acceptance checklist, source-import handoff, import workflow, archive importer, SSRF validator, AI finding validator, and available focused tests.

This is a source/repository audit only. It is not a successful build, runtime test, penetration test, or release certification.

## Confirmed findings

### Blockers

1. **Source archive has not been imported.** The branch tree contains 45 tracked files, while the reviewed archive is described as containing 82 source files. The full application source is therefore not present in this branch.
2. **The test command references absent files.** `package.json` lists 23 test files; 9 are absent from the current branch tree:
   - `test/sanitizationPrecision.test.ts`
   - `test/ssrf.test.ts`
   - `test/fixValidator.test.ts`
   - `test/uploadSafety.test.ts`
   - `test/prototypePollution.test.ts`
   - `test/layoutResponsiveness.test.ts`
   - `test/authBoundary.test.ts`
   - `test/historyPrivacy.test.ts`
   - `test/securityHeaders.test.ts`

   Because the test script chains commands with `&&`, the current full test command will stop when it reaches the first absent test file.
3. **Lockfile mismatch.** The README and roadmap identify Bun and require `bun install --frozen-lockfile`, but no `bun.lock` or `bun.lockb` is present in the current branch tree. Reproducible installation cannot be verified from this branch.
4. **Documentation drift.** The first paragraph of `docs/SOURCE_IMPORT_HANDOFF.md` calls the archive a 79-file snapshot; its archive identity section, the roadmap, and the importer describe 82 files. The opening count must be reconciled.
5. **No complete release verification.** Dependency installation, complete typecheck, production build, full test suite, and local upload-to-analysis browser smoke test are not evidenced as passing.

### Security hardening still open

- The roadmap and architecture acknowledge DNS resolution/pinning protection for custom remote endpoints as outstanding. URL validation alone does not prevent DNS rebinding between validation and connection.
- Provider adapters still require an end-to-end review for equivalent timeout, response-size, redirect, and credential-redaction enforcement.
- Full logs, reports, browser persistence, and error paths need review after the complete application source is imported.

### Detection limitations

- The current benchmark is small and synthetic. Its recorded 3 true positives, 6 true negatives, 0 false positives, and 0 false negatives apply only to 9 binary-scored fixtures.
- Review-only fixtures are intentionally excluded from binary precision/recall calculations.
- The project documentation correctly states that these numbers are not real-world accuracy claims. Larger independently labelled corpora and broader AST/control-flow/interprocedural coverage remain necessary.

## Positive observations from source inspection

- AI finding validation rejects invalid line ranges rather than clamping them and derives snippets from the actual source file rather than trusting model-supplied snippets.
- The SSRF validator includes several special-purpose IPv4 ranges, private/loopback/link-local checks, IPv4-mapped IPv6 handling, cloud metadata host checks, and local-provider port restrictions.
- The archive importer is designed to pin the reviewed archive digest, reject unsafe paths/symlinks/oversized entries and preserve differing existing files rather than overwrite them.
- The repository documentation consistently says this is a local-first review aid, not a guarantee that code is vulnerability-free, and keeps public deployment out of scope.

These observations are source-level only and do not substitute for runtime verification.

## Required work after the manual archive upload

1. Verify the uploaded archive digest against the pinned SHA-256.
2. Inspect the import workflow result and every preserved conflict.
3. Reconcile conflicts deliberately; do not blindly overwrite existing files.
4. Confirm all 82 expected source paths are present and no secrets or generated artifacts were imported.
5. Reconcile package scripts with actual test files and restore the correct committed Bun lockfile.
6. Install dependencies from the lockfile in a network-capable CI environment.
7. Run full typecheck, production build, all tests, and local end-to-end smoke tests.
8. Complete the DNS rebinding and provider-adapter hardening review.
9. Re-run security, privacy, responsive, accessibility, and regression audits on the integrated application.

## Release decision

**Not release-ready. Do not merge this branch into `main` yet.**

The source archive import and the verification gates above are prerequisites. No claim of zero defects or complete security can be made from the current evidence.
