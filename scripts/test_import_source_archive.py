"""Regression tests for source-archive path and secret screening."""
from __future__ import annotations

import unittest

from scripts.import_source_archive import safe_relative_path, scan_for_realistic_secrets


class SourceArchiveSafetyTests(unittest.TestCase):
    def test_valid_source_paths_are_stripped_from_archive_root(self) -> None:
        self.assertEqual(safe_relative_path("source/src/main.tsx"), "src/main.tsx")
        self.assertEqual(safe_relative_path("source/.env.example"), ".env.example")

    def test_traversal_and_ambiguous_paths_are_rejected(self) -> None:
        for path in (
            "../source/app.ts",
            "source/../app.ts",
            "source//app.ts",
            "source/./app.ts",
            "source\\app.ts",
            "/source/app.ts",
            "source/C:/app.ts",
            "source/CON.txt",
            "source/folder./file.ts",
            "source/trailing /file.ts",
            "source/bad?.ts",
            "source/LPT1/log.txt",
        ):
            with self.subTest(path=path):
                with self.assertRaises(ValueError):
                    safe_relative_path(path)

    def test_unexpected_archive_root_is_rejected(self) -> None:
        for path in ("app.ts", "payload/app.ts", "source/"):
            with self.subTest(path=path):
                with self.assertRaises(ValueError):
                    safe_relative_path(path)

    def test_environment_and_binary_secret_files_are_rejected(self) -> None:
        for path in ("source/.env", "source/.env.production", "source/keys/private.pem", "source/keys/private.key"):
            with self.subTest(path=path):
                with self.assertRaises(ValueError):
                    safe_relative_path(path)

    def test_generated_and_dependency_directories_are_rejected(self) -> None:
        for path in ("source/node_modules/pkg/index.js", "source/.git/config", "source/dist/app.js"):
            with self.subTest(path=path):
                with self.assertRaises(ValueError):
                    safe_relative_path(path)

    def test_private_key_and_cloud_credentials_are_rejected(self) -> None:
        for content in (
            b"-----BEGIN PRIVATE KEY-----",
            b"AKIAABCDEFGHIJKLMNOP",
            b"ghp_abcdefghijklmnopqrstuvwxyz123456",
            b"AIza12345678901234567890123456789012",
        ):
            with self.subTest(content=content):
                with self.assertRaises(ValueError):
                    scan_for_realistic_secrets("src/config.ts", content)

    def test_known_synthetic_redaction_fixture_is_allowed_only_at_its_test_path(self) -> None:
        fixture = b"ghp_abcdefghijklmnopqrstuvwxyz123456"
        scan_for_realistic_secrets("test/ssrf.test.ts", fixture)
        with self.assertRaises(ValueError):
            scan_for_realistic_secrets("src/config.ts", fixture)


if __name__ == "__main__":
    unittest.main()
