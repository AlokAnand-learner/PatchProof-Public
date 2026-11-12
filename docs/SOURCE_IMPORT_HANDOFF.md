# Source archive import handoff

The source archive is the reviewed 79-file PatchProof source snapshot. It is not a production release.

## One-time upload

1. Download the exact archive named `PatchProof-Phase1-Foundation-Hardening-2026-11-12-Continuous-Phases.zip`.
2. In GitHub, open branch `work/ssrf-special-purpose-ipv4-2026-11-12` in this repository.
3. Upload the archive at the exact path `import/PatchProof-source.zip` and commit it directly to that branch.

The GitHub Actions workflow on this branch will then:
- Verify the exact SHA-256 digest before extraction.
- Reject unsafe paths, symlinks, oversized entries, non-UTF-8 files, and recognized high-confidence credential patterns.
- Preserve any existing branch file rather than overwrite it.
- Import missing source files and remove the temporary ZIP from the branch's current tree.

The importer prints any existing paths whose contents differ from the archive. Those conflicts require review before Phase 1 can be accepted.

## Reviewed archive identity

- Files: 82
- Uncompressed content: 867,926 bytes
- SHA-256: `2e3d3b2099823ac953528bd43bbd70acb2b194ff2d4e10d78a9b5d7ac33a8a9e`

The ZIP includes synthetic token-shaped strings used by redaction tests and an intentionally vulnerable sample-code fixture. The importer has narrowly scoped allowances for the two exact synthetic token test values; it does not treat them as credentials.
