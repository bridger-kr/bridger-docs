# Bridger documentation agents

- This repository owns the published Mintlify documentation. Reuse `docs.json`, the Korean and English MDX pages, and the pinned `vendor/spec` submodule.
- Codex Cloud setup and maintenance: `bash .codex/setup.sh`. Use Node 22 or newer compatible LTS. Setup requires read access to the private spec submodule; use the existing GitHub connector rather than putting tokens in URLs or files.
- Run `bash .codex/verify.sh` for script syntax, strict Mintlify build validation, and broken-link checks. No backend, provider keys, deployment, or publication occurs.
- `package-lock.json` is currently ignored by this repo. Setup respects that convention, so transitive Mintlify installs are not fully reproducible; record the installed version with evidence.
- Run `npm run build:content` only when changing preset templates or the spec pin. It rewrites committed MDX; review that diff. The API reference generation script is currently a no-op and is not API contract validation.
- For changed pages, run `npm run dev` and inspect the actual rendered routes. A link check does not establish authenticated API or provider behavior. Keep Korean and English instructions consistent.
- Cross-repo ownership, Cloud constraints, and assignment evidence: [Bridger OKF knowledge](https://github.com/bridger-kr/bridger-roadmap/tree/codex/cloud-e2e-setup/knowledge).
