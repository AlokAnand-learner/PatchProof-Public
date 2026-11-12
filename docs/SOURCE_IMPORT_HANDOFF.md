# Source archive import handoff

The source archive is the reviewed 79-file PatchProof source snapshot. It is not a production release.

## One-time upload

1. Download the exact archive named `PatchProof-Phase1-Foundation-Hardening-2026-11-12-IPv6-SSRF-fix.zip`.
2. In GitHub, open branch `work/ssrf-special-purpose-ipv4-2026-11-12` in this repository.
3. Upload the archive at the exact path `import/PatchProof-source.zip` and commit it directly to that branch.

The GitHub Actions workflow on this branch will then:
- Verify the exact SHA-256 digest before extraction.
- Reject unsafe paths, symlinks, oversized entries, non-UTF-8 files, and recognized high-confidence credential patterns.
- Preserve any existing branch file rather than overwrite it.
- Import missing source files and remove the temporary ZIP from the branch's current tree.

The importer prints any existing paths whose contents differ from the archive. Those conflicts require review before Phase 1 can be accepted.

## Reviewed archive identity

- Files: 79
- Uncompressed content: 858,868 bytes
- SHA-256: `1c359f76a577537f7ed832503860a17e9c1a129dd3d43856441e2d3ac634e480`

The ZIP includes synthetic token-shaped strings used by redaction tests and an intentionally vulnerable sample-code fixture. The importer has narrowly scoped allowances for the two exact synthetic token test values; it does not treat them as credentials.
