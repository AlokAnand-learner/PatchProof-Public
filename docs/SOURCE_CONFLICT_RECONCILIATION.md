# Source archive conflict reconciliation

## Reviewed archive

- Archive: `PatchProof-Phase1-Foundation-Hardening-2026-11-12-Continuous-Phases.zip`
- SHA-256: `f6a0cbe3ab7e1fc0c1c8ab33ad3218ad903ac65a1fc5267342b6cd642c9770b5`
- Archive paths: 82
- Initial import comparison: 57 exact matches, 25 differing existing files, 0 missing paths (historical baseline)
- Latest CI read-only comparison: 36 exact matches, 46 differing existing files, 0 missing paths (82 archive files checked)
- The 25-path grouping below documents the initial baseline only; it is not a complete enumeration of the newer 46 conflicts.

## Reconciliation policy

The archive is an earlier project snapshot, not an instruction to replace the current working tree. The importer never overwrites differing files. The current branch versions are retained while their security and integration work is tested. Do not replace the current versions with the older archive copies simply to make the hashes match.

The 25 differing paths are grouped below:

### Build, package, and project metadata

- `bun.lock`
- `package.json`
- `tsconfig.json`
- `index.html`
- `metadata.json`

**Disposition:** retain the working-branch versions. They contain the committed lockfile, current scripts, current TypeScript configuration, and PatchProof project metadata used by the passing CI build.

### Server and security-critical implementation

- `server.ts`
- `src/engine/aiFindingValidation.ts`
- `src/engine/providerEngine.ts`
- `src/types/security.ts`
- `src/utils/apiClient.ts`
- `src/utils/ssrfValidator.ts`

**Disposition:** retain the working-branch versions. They include authentication/origin controls, bounded responses, provider consent, untrusted-source separation, model-output validation, and SSRF protections. Reconcile future changes by targeted review and tests, not whole-file replacement.

### UI and identity assets

- `src/index.css`
- `public/favicon.svg`
- `public/logo.svg`

**Disposition:** retain the current UI and asset files. The shared `src/components/PatchProofLogo.tsx` component is an exact archive match. Do not replace the official logo asset without checking it against the original user-supplied PatchProof mark.

### Documentation

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/FOUNDATION_ACCEPTANCE.md`

**Disposition:** retain the current versions because they describe the hardened branch and current acceptance gates. The development roadmap and this reconciliation note are maintained on the working branch.

### Regression tests

- `test/accuracy.test.ts`
- `test/aiFindingValidation.test.ts`
- `test/authBoundary.test.ts`
- `test/cloudConsent.test.ts`
- `test/contextAnalyzerContext.test.ts`
- `test/layoutResponsiveness.test.ts`
- `test/redos.test.ts`
- `test/reportSafety.test.ts`

**Disposition:** retain the current versions because they contain expanded security, integration, and accessibility regressions. New tests are added to these current suites rather than replaced by the older archive versions.

## Verification

- The read-only audit compares file bytes and SHA-256 values; it never writes or overwrites source files.
- The working branch passes the current TypeScript check, production build, server-backed API tests, and complete automated suite.
- This path-level reconciliation does not claim every historical line difference has been reviewed individually. Any future change to a conflicting file must preserve the current security guarantees and pass CI.
