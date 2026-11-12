#!/usr/bin/env python3
"""Read-only audit of differences between the reviewed source ZIP and working tree."""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path, PurePosixPath
import sys
import zipfile

EXPECTED_ARCHIVE_SHA256 = "f6a0cbe3ab7e1fc0c1c8ab33ad3218ad903ac65a1fc5267342b6cd642c9770b5"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def audit(archive_path: Path, destination: Path, expected_sha: str = EXPECTED_ARCHIVE_SHA256) -> tuple[int, int, int]:
    archive_bytes = archive_path.read_bytes()
    actual_sha = sha256(archive_bytes)
    if actual_sha != expected_sha:
        raise ValueError("source archive SHA-256 does not match the reviewed archive")

    root = destination.resolve()
    matches = missing = conflicts = 0
    with zipfile.ZipFile(archive_path) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            member = PurePosixPath(info.filename)
            if member.is_absolute() or len(member.parts) < 2 or member.parts[0] != "source":
                raise ValueError(f"unexpected archive member path: {info.filename}")
            relative = Path(*member.parts[1:])
            target = root / relative
            if target.is_symlink() or not target.resolve().is_relative_to(root):
                raise ValueError(f"destination path escapes repository: {relative}")
            if not target.exists():
                missing += 1
                print(f"MISSING  {relative}")
                continue
            if not target.is_file():
                conflicts += 1
                print(f"CONFLICT {relative} (working path is not a regular file)")
                continue
            archived = archive.read(info)
            current = target.read_bytes()
            if archived == current:
                matches += 1
                print(f"MATCH    {relative}")
            else:
                conflicts += 1
                print(
                    f"CONFLICT {relative} "
                    f"archive_bytes={len(archived)} working_bytes={len(current)} "
                    f"archive_sha256={sha256(archived)} working_sha256={sha256(current)}"
                )
    print(f"SUMMARY matches={matches} missing={missing} conflicts={conflicts}")
    return matches, missing, conflicts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--destination", type=Path, default=Path("."))
    parser.add_argument("--expected-sha256", default=EXPECTED_ARCHIVE_SHA256)
    args = parser.parse_args()
    matches, missing, conflicts = audit(args.archive, args.destination, args.expected_sha256)
    # Conflicts are deliberately reported, not overwritten or treated as import failures.
    print("Read-only source conflict audit complete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, zipfile.BadZipFile) as exc:
        print(f"Audit refused: {exc}", file=sys.stderr)
        raise SystemExit(2)
