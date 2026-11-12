# PatchProof architecture (local development phase)

## Product boundary

PatchProof is a single-user, local-first source-code review application. The supported runtime binds only to loopback (`localhost`, `127.0.0.1`, or `::1`). It is not a public multi-user service. Accounts, tenant isolation, remote deployment, and public ingress are explicitly deferred.

## Runtime layout

- **Browser UI:** React + TypeScript, served by Vite during development and from `dist/` in production mode.
- **Local API:** Express in `server.ts`; validates Host and Origin, applies security headers, rate limits, performs pre-body authorization, and parses bounded JSON.
- **Analysis engine:** local static/contextual analysis and optional AI hypotheses. Static heuristics are not AST/data-flow proof; AI findings remain unverified review items.
- **Provider boundary:** local Ollama/custom loopback providers are separate from remote providers. Remote transmission requires explicit server-side consent.
- **Input boundary:** source files and ZIP archives are read in memory; archive extraction does not write files or execute uploaded code. The API revalidates submitted project paths, file count, per-file size, cumulative size, and text content.
- **Persistence:** browser history/settings use browser storage; this is not encrypted storage and is accessible to same-origin JavaScript. Privacy mode removes full source from saved history by default.

## Request flow

1. Browser obtains a per-process local session token from the local bootstrap endpoint.
2. Sensitive API mutations require that token. Host and Origin policies reject non-local browser origins.
3. Upload parsing validates relative paths and file metadata before reading source text. ZIP files are inspected in memory and are never extracted to disk.
4. The server repeats path/content/size validation; client validation is only a usability layer.
5. Local analysis runs first. Optional provider analysis runs only when the selected provider is eligible and required consent is present. Model output is treated as untrusted hypothesis data.
6. Results are returned to the local browser; report/history persistence follows the disclosed privacy settings.

## Trust boundaries

- Uploaded code, filenames, ZIP metadata, browser-provided paths, provider responses, and saved browser history are untrusted.
- A client request field cannot grant cloud consent.
- Model-supplied confidence or verification labels cannot independently confirm a finding.
- A localhost-only bind is not a substitute for a future public deployment security architecture.

## Current limitations

- The analysis engine is not yet a complete AST-based, interprocedural taint engine.
- Full dependency-backed integration tests and production build must pass before calling the application release-ready.
- Custom remote endpoint DNS pinning remains a documented SSRF hardening requirement.
