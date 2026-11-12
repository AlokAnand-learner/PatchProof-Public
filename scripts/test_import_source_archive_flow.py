"""End-to-end unit tests for the reviewed source archive importer."""
from __future__ import annotations

import hashlib
from pathlib import Path
import stat
import sys
import tempfile
import unittest
import zipfile
from unittest.mock import patch

from scripts import import_source_archive


class SourceArchiveImportFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="patchproof-import-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive_path = self.root / "fixture.zip"
        self.destination = self.root / "repo"
        self.destination.mkdir()

    def write_zip(self, entries: list[tuple[str, bytes, bool]]) -> None:
        with zipfile.ZipFile(self.archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, content, is_symlink in entries:
                info = zipfile.ZipInfo(name)
                if is_symlink:
                    info.create_system = 3
                    info.external_attr = (stat.S_IFLNK | 0o777) << 16
                archive.writestr(info, content)

    def run_import(self, dry_run: bool = False) -> int:
        args = ["import_source_archive.py", str(self.archive_path), "--destination", str(self.destination)]
        if dry_run:
            args.append("--dry-run")
        digest = hashlib.sha256(self.archive_path.read_bytes()).hexdigest()
        with patch.object(import_source_archive, "EXPECTED_ARCHIVE_SHA256", digest), patch.object(sys, "argv", args):
            return import_source_archive.main()

    def test_valid_archive_imports_only_under_source_root(self) -> None:
        self.write_zip([
            ("source/", b"", False),
            ("source/src/", b"", False),
            ("source/src/app.ts", b"export const ok = true;\n", False),
        ])
        self.assertEqual(self.run_import(), 0)
        self.assertEqual((self.destination / "src/app.ts").read_bytes(), b"export const ok = true;\n")

    def test_dry_run_does_not_write_files(self) -> None:
        self.write_zip([("source/src/app.ts", b"export const ok = true;\n", False)])
        self.assertEqual(self.run_import(dry_run=True), 0)
        self.assertFalse((self.destination / "src/app.ts").exists())

    def test_existing_different_file_is_never_overwritten(self) -> None:
        target = self.destination / "src/app.ts"
        target.parent.mkdir()
        target.write_text("reviewed local content\n", encoding="utf-8")
        self.write_zip([("source/src/app.ts", b"archive content\n", False)])
        self.assertEqual(self.run_import(), 0)
        self.assertEqual(target.read_text(encoding="utf-8"), "reviewed local content\n")

    def test_symlink_archive_entry_is_rejected(self) -> None:
        self.write_zip([("source/src/link", b"../outside", True)])
        with self.assertRaises(SystemExit):
            self.run_import()

    def test_case_colliding_paths_are_rejected(self) -> None:
        self.write_zip([
            ("source/src/Config.ts", b"one\n", False),
            ("source/src/config.ts", b"two\n", False),
        ])
        with self.assertRaises(SystemExit):
            self.run_import()

    def test_oversized_compressed_archive_is_rejected_before_hashing(self) -> None:
        self.archive_path.write_bytes(b"x")
        with self.archive_path.open("r+b") as archive:
            archive.truncate(import_source_archive.MAX_ARCHIVE_BYTES + 1)
        args = ["import_source_archive.py", str(self.archive_path), "--destination", str(self.destination)]
        with patch.object(sys, "argv", args):
            with self.assertRaises(SystemExit):
                import_source_archive.main()

    def test_path_traversal_archive_entry_is_rejected(self) -> None:
        self.write_zip([("source/../outside.txt", b"not safe", False)])
        with self.assertRaises(ValueError):
            self.run_import()

    def test_directory_entry_with_traversal_is_rejected(self) -> None:
        self.write_zip([("source/../outside/", b"", False)])
        with self.assertRaises(ValueError):
            self.run_import()

    def test_symlink_directory_entry_is_rejected(self) -> None:
        self.write_zip([("source/src/link/", b"../outside", True)])
        with self.assertRaises(SystemExit):
            self.run_import()

    def test_file_colliding_with_explicit_directory_is_rejected(self) -> None:
        self.write_zip([
            ("source/config/", b"", False),
            ("source/config", b"file\n", False),
        ])
        with self.assertRaises(SystemExit):
            self.run_import()

    def test_file_directory_collision_is_rejected(self) -> None:
        self.write_zip([
            ("source/config", b"file\n", False),
            ("source/config/settings.json", b"child\n", False),
        ])
        with self.assertRaises(SystemExit):
            self.run_import()

    def test_unsupported_compression_is_rejected(self) -> None:
        with zipfile.ZipFile(self.archive_path, "w", compression=zipfile.ZIP_BZIP2) as archive:
            archive.writestr("source/src/app.ts", b"export const ok = true;\n")
        digest = hashlib.sha256(self.archive_path.read_bytes()).hexdigest()
        args = ["import_source_archive.py", str(self.archive_path), "--destination", str(self.destination)]
        with patch.object(import_source_archive, "EXPECTED_ARCHIVE_SHA256", digest), patch.object(sys, "argv", args):
            with self.assertRaises(ValueError):
                import_source_archive.main()

    def test_malformed_zip_is_rejected_without_writing(self) -> None:
        self.archive_path.write_bytes(b"not a zip archive")
        digest = hashlib.sha256(self.archive_path.read_bytes()).hexdigest()
        args = ["import_source_archive.py", str(self.archive_path), "--destination", str(self.destination)]
        with patch.object(import_source_archive, "EXPECTED_ARCHIVE_SHA256", digest), patch.object(sys, "argv", args):
            with self.assertRaises(zipfile.BadZipFile):
                import_source_archive.main()
        self.assertEqual(list(self.destination.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
