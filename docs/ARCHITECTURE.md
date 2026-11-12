# PatchProof architecture (local development phase)

## Product boundary

PatchProof is a single-user, local-first source-code review application. The supported runtime binds only to loopback (`localhost`, `127.0.0.1`, or `::1`). It is not a public multi-user service. Accounts, tenant isolation, remote deployment, and public ingress are explicitly deferred.

## Runtime layout

- **Browser UI:** React + TypeScript, served by Vite during development and from `dist/` in production mode.
- **Local API:** Express in `server.ts`; validates Host and Origin, applies security headers, rate limits, performs pre-body authorization, and parses bounded JSON. Production Content Security Policy excludes `unsafe-eval`; development-only script allowances are gated by the runtime mode.
- **Analysis engine:** local static/contextual analysis and optional AI hypotheses. Static heuristics are not AST/data-flow proof; AI findings remain unverified review items.
- **Provider boundary:** local Ollama/custom loopback providers are separate from remote providers. Remote transmission requires explicit server-side consent. Connection tests enforce the same consent and offline-mode rules as analysis; Google SDK calls use bounded timeouts, one attempt, and output-token limits.
- **SSRF destination policy:** IPv4 and IPv6 endpoint checks reject private, local, metadata, documentation, transition, and selected translation ranges. DNS resolution/pinning for user-configured remote hostnames remains a separate integration requirement; hostname screening alone does not prevent DNS rebinding.
- **Input boundary:** source files and ZIP archives must be handled in memory; archive extraction must not write files or execute uploaded code. Paths are normalized and cross-platform aliases/collisions are rejected before staging. The guarded repository archive importer enforces bounded extraction, safe portable paths, collision checks, and high-confidence credential screening.
- **AI source trust boundary:** a provider-neutral helper separates a fixed defensive system instruction from JSON-encoded uploaded source data, applies file/path/size limits, and flags common prompt-injection indicators without mutating source. These indicators are heuristic only and cannot guarantee detection. The helper is wired into the Ollama, Gemini/Gemma, OpenAI-compatible, and Anthropic request branches. Each provider receives a separate defensive system instruction and JSON-encoded source payload. High-confidence credentials are redacted before remote transmission. Review requests do not include tool declarations, and uploaded code is never executed by PatchProof. Provider-specific hosted Gemini/Anthropic contract tests and DNS pinning for user-configured remote custom endpoints remain open.
- **Persistence:** browser history/settings use browser storage; this is not encrypted storage and is accessible to same-origin JavaScript. Privacy mode removes full source from saved history by default.

## Request flow

1. Browser obtains a per-process local session token from the local bootstrap endpoint.
2. Sensitive API mutations require that token. Host and Origin policies reject non-local browser origins.
3. Upload parsing validates relative paths and file metadata before reading source text. ZIP files are inspected in memory and are never extracted to disk.
4. The server repeats path/content/size validation; client validation is only a usability layer.
5. Local analysis runs first. Optional provider analysis runs only when the selected provider is eligible and required consent is present. Model output is treated as untrusted hypothesis data. Before any provider receives source, the AI source trust-boundary helper is applied. Source is sent as inert JSON data; remote routes redact high-confidence credential patterns. Provider tool access remains disabled. These are defense-in-depth controls and do not make prompt injection or secret detection infallible.
6. Results are returned to the local browser; report/history persistence follows the disclosed privacy settings.

## Trust boundaries

- Uploaded code, filenames, ZIP metadata, browser-provided paths, provider responses, and saved browser history are untrusted.
- A client request field cannot grant cloud consent.
- Model-supplied confidence or verification labels cannot independently confirm a finding.
- Prompt-injection screening is heuristic and must never be treated as a security boundary by itself.
- A model must not receive shell, arbitrary filesystem, or arbitrary network tools while reviewing untrusted source.
- A localhost-only bind is not a substitute for a future public deployment security architecture.

## Current limitations

- The analysis engine is not yet a complete AST-based, interprocedural taint engine.
- Full dependency-backed integration tests and production build must pass before calling the application release-ready.
- Custom remote endpoint DNS pinning remains a documented SSRF hardening requirement.
