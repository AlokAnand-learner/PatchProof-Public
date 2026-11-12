# PatchProof

PatchProof is a local-first source-code security review application. It combines deterministic static/contextual checks with optional AI-generated hypotheses. It is a review aid, not a certification that a codebase is vulnerability-free.

## Current development boundary

- Single-user local application only.
- Runtime must bind to loopback: `localhost`, `127.0.0.1`, or `::1`.
- LAN/public binding and public deployment are out of scope for this development phase.
- Uploaded source and archive metadata are untrusted; uploaded code must never be executed.
- Remote AI transmission is optional and requires explicit consent.
- AI-generated findings remain hypotheses until independently verified.
- Browser localStorage is not encrypted and may be accessible to same-origin JavaScript.

## Project status

This repository is being populated from the reviewed PatchProof source archive in controlled batches. The current working branch contains the foundation and security work, but it is not yet a verified runnable release. Do not merge it into `main` until the full source tree, dependency installation, typecheck, build, test suite, and local smoke test pass.

See [the architecture](docs/ARCHITECTURE.md), [foundation acceptance checklist](docs/FOUNDATION_ACCEPTANCE.md), and [development roadmap](docs/DEVELOPMENT_ROADMAP.md).

## Runtime requirements

- Node.js 20.19 or later; development is pinned to 22.16.0 in `.nvmrc`.
- Bun (the package manager selected for this project). The committed lockfile is not yet present on this branch; frozen installation remains blocked until the reviewed source import and lockfile reconciliation are complete.

## Run locally

```bash
bun install --frozen-lockfile
bun run dev
```

Open `http://127.0.0.1:3000`.

For verification:

```bash
bun run test
bun run typecheck
bun run build
```

Bun is the selected package manager. Do not use `--frozen-lockfile` until the matching lockfile has been committed and verified. The canonical frozen-install command will be `bun install --frozen-lockfile` after that gate is satisfied.

## Read-only repository preflight

Before attempting dependency installation or the full test script, run the standard-library preflight:

```bash
python3 scripts/repo_preflight.py .
python3 scripts/repo_preflight.py . --json
```

It checks that test files referenced by `package.json` exist, reports a missing Bun lockfile, and flags common secret-bearing filenames. It does not modify the repository and is not a substitute for dependency-backed tests or a security audit.

## Verification gate

Phase 1 is not complete until the complete source tree is present, dependency installation succeeds from the committed lockfile, typecheck and production build pass, all automated tests pass, and a local upload-to-analysis smoke test succeeds.
