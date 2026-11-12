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

MAX_ENTRIES = 256
MAX_ARCHIVE_BYTES = 12 * 1024 * 1024
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
    if len(raw_parts) > 33 or len(name) > 1024:
        raise ValueError(f"path exceeds depth or length limit: {name!r}")
    for part in raw_parts:
        if len(part.encode("utf-8")) > 255 or part.endswith((" ", ".")):
            raise ValueError(f"non-portable path component: {name!r}")
        if any(ord(char) < 32 or char in '<>:"|?*' for char in part):
            raise ValueError(f"non-portable path character: {name!r}")
        device_name = part.split(".", 1)[0].upper()
        if device_name in {"CON", "PRN", "AUX", "NUL"} or re.fullmatch(r"(?:COM|LPT)[1-9]", device_name):
            raise ValueError(f"reserved cross-platform path component: {name!r}")
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


def read_entry_bounded(archive: zipfile.ZipFile, info: zipfile.ZipInfo, remaining_total: int) -> bytes:
    """Read one ZIP member with a hard bound on actual decompressed bytes."""
    if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
        raise ValueError(f"unsupported compression method: {info.filename}")
    if info.file_size > MAX_FILE_BYTES or info.file_size > remaining_total:
        raise ValueError(f"declared extracted size exceeds limits: {info.filename}")
    chunks: list[bytes] = []
    actual_size = 0
    with archive.open(info, "r") as member:
        while True:
            chunk = member.read(min(64 * 1024, MAX_FILE_BYTES + 1 - actual_size))
            if not chunk:
                break
            actual_size += len(chunk)
            if actual_size > MAX_FILE_BYTES or actual_size > remaining_total:
                raise ValueError(f"actual extracted size exceeds limits: {info.filename}")
            chunks.append(chunk)
    if actual_size != info.file_size:
        raise ValueError(f"declared and actual extracted sizes differ: {info.filename}")
    return b"".join(chunks)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--destination", type=Path, default=Path("."))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.archive.is_file():
        raise SystemExit(f"archive not found: {args.archive}")
    archive_size = args.archive.stat().st_size
    if archive_size > MAX_ARCHIVE_BYTES:
        raise SystemExit(f"archive exceeds compressed-size limit of {MAX_ARCHIVE_BYTES} bytes")
    archive_hash = hashlib.sha256(args.archive.read_bytes()).hexdigest()
    if archive_hash != EXPECTED_ARCHIVE_SHA256:
        raise SystemExit("archive SHA-256 does not match the reviewed source archive")

    planned: list[tuple[str, bytes]] = []
    seen: set[str] = set()
    seen_casefolded: set[str] = set()
    total = 0
    with zipfile.ZipFile(args.archive) as archive:
        all_infos = archive.infolist()
        if len(all_infos) > MAX_ENTRIES:
            raise SystemExit(f"archive has {len(all_infos)} entries; limit is {MAX_ENTRIES}")
        infos = [item for item in all_infos if not item.is_dir()]
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
            data = read_entry_bounded(archive, info, MAX_TOTAL_BYTES - (total - info.file_size))
            if len(data) != info.file_size:
                raise ValueError(f"unexpected extracted size: {rel}")
            data.decode("utf-8", errors="strict")
            scan_for_realistic_secrets(rel, data)
            planned.append((rel, data))

    planned_paths = {rel for rel, _ in planned}
    for rel in planned_paths:
        parts = PurePosixPath(rel).parts
        for index in range(1, len(parts)):
            parent = PurePosixPath(*parts[:index]).as_posix()
            if parent in planned_paths:
                raise SystemExit(f"file/directory path collision: {parent} and {rel}")

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
    except (ValueError, RuntimeError, NotImplementedError, zipfile.BadZipFile, UnicodeDecodeError, EOFError) as exc:
        print(f"Import refused: {exc}", file=sys.stderr)
        raise SystemExit(2)
