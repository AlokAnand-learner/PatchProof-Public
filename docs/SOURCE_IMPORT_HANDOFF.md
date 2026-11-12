# Source archive import handoff

The source archive is the reviewed 82-file PatchProof source snapshot. It is not a production release.

## Upload status

The archive has been uploaded to the repository root on branch `work/ssrf-special-purpose-ipv4-2026-11-12`:

`PatchProof-Phase1-Foundation-Hardening-2026-11-12-Continuous-Phases.zip`

The import workflow accepts this root location as well as the originally planned `import/PatchProof-source.zip` location. A workflow update will trigger validation of the already-uploaded root archive.

## Validation and import

The GitHub Actions workflow will:
- Verify the exact SHA-256 digest before extraction.
- Reject unsafe paths, symlinks, oversized entries, non-UTF-8 files, and recognized high-confidence credential patterns.
- Preserve any existing branch file rather than overwrite it.
- Import missing source files and remove the temporary ZIP from the branch's current tree.

The importer prints any existing paths whose contents differ from the archive. Those conflicts are preserved for review; they are not silently overwritten. A successful archive validation does not by itself mean the application build or all phases are complete.

## Reviewed archive identity

- Files: 82
- Uncompressed content: 868,355 bytes
- SHA-256: `f6a0cbe3ab7e1fc0c1c8ab33ad3218ad903ac65a1fc5267342b6cd642c9770b5`

The ZIP includes synthetic token-shaped strings used by redaction tests and an intentionally vulnerable sample-code fixture. The importer has narrowly scoped allowances for the two exact synthetic token test values; it does not treat them as credentials.
