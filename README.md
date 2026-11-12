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

This repository is being populated from the working PatchProof source archive in controlled batches. A branch may contain only part of the application until the complete source tree, dependency lockfile, and test environment have been imported and verified. Do not treat a partial import as a runnable release.

See [the architecture](docs/ARCHITECTURE.md), [foundation acceptance checklist](docs/FOUNDATION_ACCEPTANCE.md), and [development roadmap](docs/DEVELOPMENT_ROADMAP.md).

## Runtime requirements

- Node.js 20.19 or later; development is pinned to 22.16.0 in `.nvmrc`.
- The source archive includes a Bun lockfile. Package-manager and lockfile alignment must be finalized before claiming reproducible installs.

## Verification gate

Phase 1 is not complete until the complete source tree is present, dependency installation succeeds from the committed lockfile, typecheck and production build pass, all automated tests pass, and a local upload-to-analysis smoke test succeeds.
