#!/usr/bin/env python3
"""Safely import the reviewed PatchProof source ZIP without overwriting reviewed files."""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import unicodedata
import zipfile

MAX_ENTRIES = 100
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_TOTAL_BYTES = 6 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200
EXPECTED_ARCHIVE_SHA256 = "f6a0cbe3ab7e1fc0c1c8ab33ad3218ad903ac65a1fc5267342b6cd642c9770b5"

PRIVATE_KEY = re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")
AWS_KEY = re.compile(rb"AKIA[0-9A-Z]{16}")
GITHUB_TOKEN = re.compile(rb"gh[pousr]_[A-Za-z0-9]{20,}")
GOOGLE_KEY = re.compile(rb"AIza[0-9A-Za-z_-]{30,}")

# Exact synthetic strings used by redaction tests; not credentials.
SYNTHETIC_FIXTURES = {
    "test/ssrf.test.ts": {
        b"ghp_abcdefghijklmnopqrstuvwxyz123456",
        b"AIzaSyD9876543210zyxwvutsrqponmlkj",
    }
}
SKIP_PARTS = {".git", "node_modules", "dist", "coverage", ".next", ".venv", "__pycache__"}
SKIP_SUFFIXES = {".db", ".sqlite", ".sqlite3", ".pem", ".key", ".p12", ".pfx"}


def safe_relative_path(name: str) -> str:
    if not name or "\\" in name or "\x00" in name or ":" in name:
        raise ValueError(f"unsafe path syntax: {name!r}")
    raw_parts = name.split("/")
    if any(part in ("", ".", "..") for part in raw_parts):
        raise ValueError(f"unsafe or non-canonical path: {name!r}")
    pure = PurePosixPath(name)
    if pure.is_absolute() or not pure.parts or pure.parts[0] != "source":
        raise ValueError(f"unexpected archive root: {name!r}")
    rel = PurePosixPath(*pure.parts[1:])
    if not rel.parts:
        raise ValueError("empty source path")
    if any(part in SKIP_PARTS for part in rel.parts):
        raise ValueError(f"excluded generated/dependency path: {name!r}")
    if rel.name == ".env" or (rel.name.startswith(".env.") and rel.name != ".env.example"):
        raise ValueError(f"environment file is not importable: {name!r}")
    if rel.suffix.lower() in SKIP_SUFFIXES:
        raise ValueError(f"sensitive/binary file type is not importable: {name!r}")
    return rel.as_posix()


def scan_for_realistic_secrets(rel: str, content: bytes) -> None:
    patterns = (("private key", PRIVATE_KEY), ("AWS access key", AWS_KEY),
                ("GitHub token", GITHUB_TOKEN), ("Google API key", GOOGLE_KEY))
    allowed = SYNTHETIC_FIXTURES.get(rel, set())
    for label, pattern in patterns:
        for match in pattern.finditer(content):
            if match.group(0) not in allowed:
                raise ValueError(f"possible {label} detected in {rel}; refusing import")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--destination", type=Path, default=Path("."))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.archive.is_file():
        raise SystemExit(f"archive not found: {args.archive}")
    archive_hash = hashlib.sha256(args.archive.read_bytes()).hexdigest()
    if archive_hash != EXPECTED_ARCHIVE_SHA256:
        raise SystemExit("archive SHA-256 does not match the reviewed source archive")

    planned: list[tuple[str, bytes]] = []
    seen: set[str] = set()
    seen_casefolded: set[str] = set()
    total = 0
    with zipfile.ZipFile(args.archive) as archive:
        infos = [item for item in archive.infolist() if not item.is_dir()]
        if len(infos) > MAX_ENTRIES:
            raise SystemExit(f"archive has {len(infos)} files; limit is {MAX_ENTRIES}")
        for info in infos:
            rel = safe_relative_path(info.filename)
            normalized_key = unicodedata.normalize('NFC', rel).casefold()
            if rel in seen or normalized_key in seen_casefolded:
                raise SystemExit(f"duplicate or case-colliding normalized path: {rel}")
            seen.add(rel)
            seen_casefolded.add(normalized_key)
            mode = (info.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(mode):
                raise SystemExit(f"symlink entries are not allowed: {info.filename}")
            if info.file_size > MAX_FILE_BYTES:
                raise SystemExit(f"file exceeds size limit: {rel}")
            total += info.file_size
            if total > MAX_TOTAL_BYTES:
                raise SystemExit("archive exceeds total extracted-size limit")
            if info.file_size and info.compress_size == 0:
                raise SystemExit(f"invalid compressed size: {rel}")
            if info.compress_size and info.file_size / info.compress_size > MAX_COMPRESSION_RATIO:
                raise SystemExit(f"suspicious compression ratio: {rel}")
            data = archive.read(info)
            data.decode("utf-8", errors="strict")
            scan_for_realistic_secrets(rel, data)
            planned.append((rel, data))

    root = args.destination.resolve()
    added = identical = 0
    conflicts: list[str] = []
    for rel, data in planned:
        target = root / rel
        for parent in (target, *target.parents):
            if parent == root:
                break
            if parent.is_symlink() or not parent.resolve().is_relative_to(root):
                raise SystemExit(f"destination path crosses a symlink or escapes the repository: {rel}")
        if target.exists():
            if target.is_file() and hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(data).digest():
                identical += 1
            else:
                # Preserve manually reviewed branch files; never overwrite them.
                conflicts.append(rel)
            continue
        added += 1
        if not args.dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)

    print(f"Archive files validated: {len(planned)}")
    print(f"New files {'planned' if args.dry_run else 'written'}: {added}")
    print(f"Already identical: {identical}")
    print(f"Existing files preserved (content differs): {len(conflicts)}")
    if conflicts:
        print("Preserved paths requiring manual reconciliation:")
        for path in conflicts:
            print(f"  - {path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, zipfile.BadZipFile, UnicodeDecodeError) as exc:
        print(f"Import refused: {exc}", file=sys.stderr)
        raise SystemExit(2)
