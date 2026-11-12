#!/usr/bin/env python3
"""Read-only PatchProof repository preflight; reports release blockers without modifying files."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import re

TEST_COMMAND = re.compile(r"(?:^|&&)\s*tsx\s+(test/[^\s&]+)")
SENSITIVE_NAMES = {".env", "id_rsa", "id_ed25519", "credentials.json", "service-account.json"}
LOCKFILES = ("bun.lock", "bun.lockb")


def inspect(root: Path) -> dict:
    findings: list[dict[str, str]] = []
    package_path = root / "package.json"
    if not package_path.is_file():
        findings.append({"severity": "error", "code": "PACKAGE_MANIFEST_MISSING", "path": "package.json", "message": "package.json is missing"})
        package = {}
    else:
        try:
            package = json.loads(package_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            findings.append({"severity": "error", "code": "PACKAGE_MANIFEST_INVALID", "path": "package.json", "message": f"package.json cannot be parsed: {exc}"})
            package = {}

    scripts = package.get("scripts", {}) if isinstance(package, dict) else {}
    test_script = scripts.get("test", "") if isinstance(scripts, dict) else ""
    for relative in TEST_COMMAND.findall(test_script if isinstance(test_script, str) else ""):
        if not (root / relative).is_file():
            findings.append({"severity": "error", "code": "SCRIPT_TARGET_MISSING", "path": relative, "message": f"test script references missing file: {relative}"})

    if not any((root / name).is_file() for name in LOCKFILES):
        findings.append({"severity": "warning", "code": "LOCKFILE_MISSING", "path": "bun.lock", "message": "No Bun lockfile is present; frozen/reproducible installation is unavailable"})

    for candidate in root.rglob("*"):
        if not candidate.is_file():
            continue
        rel = candidate.relative_to(root)
        if any(part in {".git", "node_modules", ".venv", "dist", "coverage"} for part in rel.parts):
            continue
        if candidate.name in SENSITIVE_NAMES or (candidate.name.startswith(".env.") and candidate.name != ".env.example"):
            findings.append({"severity": "error", "code": "SENSITIVE_FILE_PRESENT", "path": rel.as_posix(), "message": "Potential secret-bearing file is present in the working tree"})

    errors = sum(item["severity"] == "error" for item in findings)
    warnings = sum(item["severity"] == "warning" for item in findings)
    return {"status": "blocked" if errors else ("warning" if warnings else "clear"), "errors": errors, "warnings": warnings, "findings": findings}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", type=Path, default=Path.cwd())
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = parser.parse_args()
    result = inspect(args.root.resolve())
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"PatchProof preflight: {result['status']} ({result['errors']} errors, {result['warnings']} warnings)")
        for item in result["findings"]:
            print(f"[{item['severity'].upper()}] {item['code']} {item['path']}: {item['message']}")
    return 1 if result["errors"] else 0

if __name__ == "__main__":
    raise SystemExit(main())
