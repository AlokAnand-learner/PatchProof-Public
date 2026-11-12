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


## Follow-up status — subsequent development on the same branch

The findings above describe the repository snapshot inspected at the time of the initial audit. They are historical baseline findings and must not be read as the current branch state.

### Superseded baseline blockers

- The source archive was subsequently imported. The path reconciliation records 82 expected paths, with 57 exact matches, 25 differing existing files, and no missing paths. The remaining 25 differences still require semantic review; path presence alone does not prove equivalent behavior.
- The previously missing test files are now present. The current tree includes the complete configured test set plus the source-line resource-limit suite.
- The committed Bun lockfile is now present and frozen installation is exercised in CI.
- CI now runs preflight and application validation. Run `43270799907` at commit `894b22a6fdeb2833651aa1bdda40eab731099ceb` completed with both jobs successful. It included type/build validation and the complete configured regression chain.

### Additional hardening completed after the baseline audit

- Remote OpenAI-compatible and Custom HTTPS requests now share DNS-pinned transport; redirects are rejected.
- Credential redaction now covers unquoted assignments, YAML-style values, short values, and common prefixed provider/connection variable names. This remains heuristic and is not a complete secret scanner.
- ZIP entry-count metadata is checked before JSZip parsing. Actual decompression is streamed and bounded by actual output bytes, rather than relying only on attacker-controlled size declarations.
- Folder uploads reject excessive selections before copying the selection and compare actual UTF-8 content bytes with file metadata.
- ZIP/folder ingestion and single-file/multi-file server analysis reject excessive line counts before allocating large line arrays: 100,000 lines per file and 300,000 lines per project.
- Report downloads sanitize filenames, defer object-URL revocation to avoid racing mobile downloads, and the Markdown copy control now reports success only after the clipboard write resolves.
- Privacy-mode history now also heuristically redacts likely credentials copied into retained finding snippets, surrounding evidence, explanations, and suggested patches while preserving review context.

### Remaining verification and engineering work

- Local browser upload-to-analysis smoke testing remains pending; CI source tests do not replace a real browser/device run.
- Live DNS/TLS integration fixtures remain outstanding for pinned remote connections.
- Hosted Gemini and Anthropic provider-specific mock/credential-backed contract checks remain outstanding.
- The 25 differing source files still need semantic conflict review.
- Detection precision still needs a substantially larger independently labelled corpus and broader interprocedural analysis.
- Responsive behavior, keyboard accessibility, and assistive-technology behavior still need real-device/browser verification.
- The current local-only deployment boundary must remain in force until a separate deployment threat model and security review are completed.

The application is still **not release-ready**. Passing CI is meaningful regression evidence, not proof of zero vulnerabilities or a complete penetration test.


### Further product-trust and resource controls

- The results view and exported reports now state whether AI ran, whether it failed or fell back to static checks, and when only a prefix of a source file was sent to AI. Multi-file AI requests are capped at 10 files per project; the remaining eligible files still receive local static checks and are identified as AI-unreviewed.
- Finding-origin metrics are derived from actual finding tags rather than hardcoded values. AI findings remain NEEDS_REVIEW; AI output is not allowed to label itself confirmed.
- Expensive provider and analysis routes are limited to two concurrent tasks per local server process.
- A finding's static pattern-suppression marker can no longer be mistaken for patch validation. Fix-validation descriptions no longer claim full AST/compiler or runtime verification.
- Full-file AI rewrites are no longer exposed as validated output. Suggested snippets can be exported as patch artifacts; full-file AI output is not applied or exported through the patch viewer.
- The results screen and reports use “Heuristic Risk Indicator” language and explicitly state that a clean pattern scan is not proof of security.
- Provider key and cloud-source handling disclosures were corrected. Users are told that keys are sent to the selected provider endpoint and that source may be transmitted when cloud consent is enabled.
- Browser-history write failures are now reported separately from successful analysis, so a completed review is not mislabeled as failed or silently claimed to be saved.
- View transitions and card motion were added with a reduced-motion override.

### Verification still required

- CI on the current branch must pass after the latest batch; intermediate failed runs from staged test/code corrections are not accepted as final evidence.
- Manual local browser/device validation remains pending, including upload-to-analysis, patch export/apply flow, mobile layouts, keyboard navigation and reduced-motion behavior.
- The 25 differing source files still require semantic reconciliation against the original supplied source archive. The archive itself must be available to complete that comparison.
- Detection accuracy claims remain limited to the small synthetic benchmark; no production-grade recall/precision claim is made.
