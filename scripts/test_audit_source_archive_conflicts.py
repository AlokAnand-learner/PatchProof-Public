import hashlib
from pathlib import Path
import tempfile
import unittest
import zipfile

from scripts.audit_source_archive_conflicts import audit


class SourceArchiveConflictAuditTests(unittest.TestCase):
    def make_archive(self, archive_path: Path, entries: dict[str, bytes]) -> str:
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, content in entries.items():
                archive.writestr(name, content)
        return hashlib.sha256(archive_path.read_bytes()).hexdigest()

    def test_reports_match_missing_and_conflict_without_overwriting(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "same.txt").write_bytes(b"same")
            (root / "changed.txt").write_bytes(b"working")
            archive = root / "reviewed.zip"
            digest = self.make_archive(archive, {
                "source/same.txt": b"same",
                "source/changed.txt": b"archive",
                "source/missing.txt": b"new",
            })
            result = audit(archive, root, digest)
            self.assertEqual(result, (1, 1, 1))
            self.assertEqual((root / "changed.txt").read_bytes(), b"working")
            self.assertFalse((root / "missing.txt").exists())

    def test_rejects_wrong_archive_digest(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "reviewed.zip"
            self.make_archive(archive, {"source/a.txt": b"source"})
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                audit(archive, root, "0" * 64)

    def test_rejects_paths_outside_source_root(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "reviewed.zip"
            digest = self.make_archive(archive, {"../escape.txt": b"bad"})
            with self.assertRaisesRegex(ValueError, "unexpected archive member path"):
                audit(archive, root, digest)


if __name__ == "__main__":
    unittest.main()
