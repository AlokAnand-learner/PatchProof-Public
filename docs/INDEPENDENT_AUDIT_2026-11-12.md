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
- Hosted Gemini and Anthropic source-contract checks now assert request shape and pinned transport; provider-specific mock-server/credential-backed integration checks remain outstanding.
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


### Follow-up engineering — provider egress and ZIP preflight

- Gemini/Gemma requests now use the Google REST endpoint through the shared DNS-pinned HTTPS transport instead of the Google SDK's independent network stack. API keys are sent in the `x-goog-api-key` header, not in the URL. Connection probes use a 10-token output cap; analysis responses remain byte-bounded.
- Anthropic connection tests and analysis now use the same pinned HTTPS transport as OpenAI-compatible and remote Custom HTTPS requests. Redirects remain rejected and response bodies are bounded.
- Provider source-contract tests now separately assert pinned transport for Google and Anthropic connection/analysis paths. These are contract tests, not live provider integration tests.
- ZIP preflight now verifies the actual central-directory record count and record lengths against EOCD/ZIP64 metadata before JSZip parses the archive. It requires the central directory to end at the correct EOCD boundary, preventing a false EOCD signature in a ZIP comment from substituting a fake zero-entry directory.
- ZIP symlink permission checks recognize numeric, octal-string, and symbolic permission representations. Regression tests cover the permission parser and a Unix-mode symlink archive.
- The upload/archive suite and application validation both passed in GitHub Actions run [43286681123](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43286681123) at code commit `5cd61af1d0d667d4ec7aed332454134675e25ba8`. Subsequent branch commits in this batch update documentation only.

### Remaining release gates

- Live DNS/TLS fixtures and provider-specific Gemini/Anthropic mock or credential-backed tests.
- Semantic reconciliation of the 25 differing source files, if the original source archive is available.
- Larger independently labelled detection corpus, including interprocedural data flow and false-positive coverage.
- Real browser/device checks for upload-to-analysis, responsive layouts, keyboard access, focus management, and reduced motion.
- A separate deployment threat model before any non-loopback/public deployment.

CI success does not establish that PatchProof is vulnerability-free or release-ready.


### Follow-up engineering — persisted history integrity

- Browser history loading now validates required record fields and the nested scan-result shape before returning records to the UI. Malformed entries are ignored rather than passed through as typed history records.
- Loaded history is capped at 40 entries, matching the save-time retention cap. The validated representation is persisted when possible, including when privacy mode is explicitly disabled.
- Enabling privacy mode now filters malformed records before redacting retained history.
- Regression tests cover malformed records, oversized history lists, storage write failures, and failed single/bulk deletion.
- Both CI jobs passed at code commit `f90089aa5c162659ca518087266fdf9535f56ef7` in [run 43287475452](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43287475452). The following branch change updates architecture documentation only.


### Follow-up engineering — provider timeout and concurrency integrity

- Removed detached Promise.race timers from all three server-side provider-analysis entry points. Previously, the HTTP route could return on its own timer while the underlying provider request continued running, releasing the concurrency slot too early.
- Routes now await provider completion. Ordinary provider fetches retain their AbortController-backed deadline; DNS-pinned HTTPS requests enforce a hard wall-clock deadline and destroy the underlying request on timeout or response overflow.
- Added a CI contract test covering all three awaited provider routes and both transport deadline mechanisms.
- Both CI jobs passed at code commit 669239b5e21a2e2718e76d23789ee547c8cc62bd in [run 43288091975](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43288091975). A following branch commit updates architecture documentation only.

### Follow-up engineering — bounded local source-to-sink continuity

- The contextual taint heuristic previously inspected only the short evidence window (five preceding lines), so ordinary statements between a request-derived assignment and a sensitive sink could cause a missed local flow.
- The heuristic now inspects up to 200 preceding lines from the same file, while retaining its function-boundary resets and keeping displayed evidence snippets small. This remains a bounded lexical heuristic, not AST, control-flow, or interprocedural taint analysis.
- Added a regression case with intervening ordinary statements and retained cross-function isolation and multiline-comment cases.
- Both CI jobs passed for the new analyzer and regression-test commits in runs [43289649501](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43289649501) and [43289655700](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43289655700). The latest branch head is the test commit.

### Follow-up engineering — patch application guardrails

- The patch viewer now refuses to apply fixes marked INVALID inside the application handler itself; there is no “Apply Anyway” confirmation path that can bypass the validation state.
- Snippet application now rejects non-integer, non-positive, reversed, or out-of-file line ranges rather than allowing JavaScript array splicing to append or replace unintended content.
- Full-file AI output remains preview-only. The apply action also rejects empty suggested patches.
- Added a source-contract regression test and included it in both the complete test chain and focused security chain.
- Both CI jobs passed after the patch-application change in [run 43290244089](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43290244089); the final package/test-chain update passed in [run 43290283049](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43290283049).
- This guardrail does not prove a patch is semantically correct or eliminate stale-content risks; review and a fresh scan remain necessary.

### Follow-up engineering — patch target integrity and validation endpoint limits

- Full-file patch validation now requires the exact original snippet to be supplied and to occur exactly once in the source. Missing or repeated target snippets fail closed rather than validating an unchanged or ambiguous replacement.
- Added regression cases for absent, empty, and duplicate original snippets.
- The fix-validation API now type-checks optional request fields, applies per-field 2 MiB and aggregate 6 MiB UTF-8 byte limits to code inputs, and bounds metadata lengths.
- Fix-validation and fix-benchmark routes now share the server's concurrency gate to limit simultaneous CPU-heavy static validation work.
- Added a request-contract regression test and included it in the main and focused security test chains.
- Both CI jobs, including preflight tests, TypeScript type-check, production build, and application startup validation, passed at [run 43290818258](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43290818258).
- These checks reduce ambiguous edits and resource-exhaustion exposure; they do not prove semantic patch correctness or eliminate all denial-of-service risks.


### Follow-up engineering — immutable AI trust boundary and patch target freshness

- Client-controlled review requests are now always serialized in the untrusted user-data payload, even when uploaded files are present. They are never appended to the provider's trusted system instruction.
- The source-boundary helper no longer accepts a caller-supplied trusted-task extension; its defensive system instruction is immutable.
- Remote review-request text receives the same heuristic credential redaction as uploaded source. This is defense-in-depth and does not replace user review or a complete secret scanner.
- Regression coverage includes prompt-injection-like review requests, prompt-injection-like source comments, remote prompt secret redaction, and compatibility for bounded legacy source prompts.
- Patch application is isolated in a pure helper with runtime regression tests. It requires the configured static validation status to be VALIDATED; NEEDS_REVIEW, PARTIALLY_VALIDATED, and INVALID results cannot be applied from the viewer.
- Before applying, the current source lines must exactly match the finding's source-derived evidence snippet. Invalid, reversed, out-of-file, excessive, stale, or mismatched ranges fail closed. Full-file output remains preview-only.
- The UI delegates to the helper and applies the returned string only after an explicit user click; the helper itself does not persist files or execute code.
- CI passed both jobs for the trust-boundary and patch-application changes in [run 43291933282](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43291933282), [run 43292209546](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43292209546), and [run 43292747982](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43292747982).
- These are guardrails, not a claim that model output is reliable or that static validation proves runtime security.


### Follow-up engineering — concurrency slot lifetime

- The previous concurrency middleware released slots on the HTTP response `close` event. A disconnected client could therefore free capacity while an awaited provider request or analysis task continued in the background.
- Replaced response-lifecycle release with a promise-scoped helper. The slot is held until the handler's returned Promise settles, including rejection; disconnecting the client does not release it early.
- Provider, model-query, analysis, fix-validation, and benchmark routes now use the completion-bound wrapper. The two-task limit remains enforced.
- Added runtime tests proving pending tasks retain their slots, busy gates reject extra work, and both success and failure release exactly once. Source-contract tests verify routes use the wrapper and no longer release on response close.
- Both CI jobs passed after the final concurrency lifecycle changes in [run 43293738702](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43293738702).


### Follow-up engineering — staged upload state revalidation

- Multi-batch upload merging previously recalculated existing file sizes and line counts but did not revalidate existing staged paths/content before retaining them.
- Existing staged entries are now rechecked for safe relative paths, supported source type, non-empty string content, actual UTF-8 byte limits, per-file/project line limits, and file-count limits. Stored size/line metadata is recomputed.
- A shared path registry rejects duplicate/case-colliding paths, Unicode-normalized collisions, case-colliding parent directories, and file/directory prefix conflicts across existing and incoming batches.
- Regression tests cover unsafe pre-staged paths, stale metadata, duplicate entries, parent-directory collisions, file/directory conflicts, and cumulative resource limits.
- Both CI jobs passed at [run 43294539727](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43294539727).


### Follow-up engineering — nested history record validation

- History loading previously checked that nested findings were objects but did not validate their required display fields, line ranges, metrics, or project-file record shape.
- Browser history now validates required scan metadata, core metrics, findings and evidence fields, line-range ordering, optional fix-validation status, recommendations, and per-file records before passing records to the UI.
- History records must keep the top-level and nested scan IDs consistent. Malformed records are discarded and the validated, bounded history representation is persisted when possible.
- Regression cases cover malformed nested finding fields and invalid metrics in addition to null findings and history-list overflow.
- Both CI jobs passed at [run 43295116948](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43295116948).


### Follow-up engineering — explicit review-request policy

- The immutable provider system instruction now explicitly identifies the `reviewRequest` field as untrusted user input. It may prioritize a defensive review but cannot override the system policy, request hidden data, or authorize tools, network access, or code execution.
- Provider tests assert this policy is present for local Ollama and OpenAI-compatible request construction, and that malicious review text remains only in the user-data payload.
- Both CI jobs passed after the final prompt-policy and fixture updates in [run 43295479384](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43295479384).

### Follow-up engineering — AI report text hygiene and production browser policy

- AI-generated summary and recommendation strings now pass through a shared bounded-text sanitizer before they are returned to the UI. It removes control characters and bidirectional formatting controls and enforces field length limits. React text rendering remains required; this sanitizer is not HTML sanitization or semantic validation.
- Production CSP now restricts browser connections to same-origin. Vite loopback WebSocket allowances are development-only, form submissions are same-origin, and framing is disabled with `frame-ancestors 'none'`.
- Regression tests cover Unicode/control-character handling, bounded report text, production CSP restrictions, and development-only WebSocket allowances.
- CI verification for the AI text sanitizer passed in [run 43296659766](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43296659766). The production CSP change and corrected test expectation passed both jobs in [run 43296873993](https://github.com/AlokAnand-learner/PatchProof-Public/actions/runs/43296873993).
- These controls reduce unsafe display artifacts and browser-side local-network exposure; they do not eliminate XSS, prompt injection, or every browser attack surface.
