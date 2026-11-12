"""Unit tests for the read-only repository preflight checks."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.repo_preflight import inspect


class RepositoryPreflightTests(unittest.TestCase):
    def make_root(self) -> Path:
        self.addCleanup(self._cleanup_root)
        root = Path(tempfile.mkdtemp(prefix="patchproof-preflight-"))
        self._temp_root = root
        return root

    def _cleanup_root(self) -> None:
        root = getattr(self, "_temp_root", None)
        if root is not None:
            import shutil
            shutil.rmtree(root, ignore_errors=True)

    def test_missing_package_manifest_is_an_error(self) -> None:
        result = inspect(self.make_root())
        self.assertEqual(result["status"], "blocked")
        self.assertIn("PACKAGE_MANIFEST_MISSING", {item["code"] for item in result["findings"]})

    def test_missing_test_target_is_reported(self) -> None:
        root = self.make_root()
        (root / "package.json").write_text(
            json.dumps({"scripts": {"test": "tsx test/not-present.test.ts"}}),
            encoding="utf-8",
        )
        result = inspect(root)
        self.assertIn("SCRIPT_TARGET_MISSING", {item["code"] for item in result["findings"]})
        self.assertIn("LOCKFILE_MISSING", {item["code"] for item in result["findings"]})

    def test_bun_lockfile_removes_lockfile_warning(self) -> None:
        root = self.make_root()
        (root / "package.json").write_text("{}", encoding="utf-8")
        (root / "bun.lock").write_text("# lockfile placeholder for preflight fixture\n", encoding="utf-8")
        result = inspect(root)
        self.assertNotIn("LOCKFILE_MISSING", {item["code"] for item in result["findings"]})

    def test_common_secret_filename_is_flagged(self) -> None:
        root = self.make_root()
        (root / "package.json").write_text("{}", encoding="utf-8")
        (root / ".env.production").write_text("SHOULD_NOT_BE_REAL=fixture-only\n", encoding="utf-8")
        result = inspect(root)
        self.assertIn("SENSITIVE_FILE_PRESENT", {item["code"] for item in result["findings"]})

    def test_invalid_package_json_is_reported(self) -> None:
        root = self.make_root()
        (root / "package.json").write_text("{not-json", encoding="utf-8")
        result = inspect(root)
        self.assertIn("PACKAGE_MANIFEST_INVALID", {item["code"] for item in result["findings"]})


if __name__ == "__main__":
    unittest.main()
