# DATA BRIDGE docs

Mintlify documentation for DATA BRIDGE (ko/en) — published at `docs.datari.kr`.

> **Private.** Image digest bumped into `datari-gitops` via cross-repo PR.

## Layout

| Path         | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `<section>/` | Mintlify pages (`getting-started/`, `concepts/`, `guides/`, `api-reference/`, `presets/`) |
| `docs.json`  | navigation, theme, anchors                             |
| `logo/`      | brand assets                                           |
| `nginx.conf` | static-server config used by the production image     |
| `scripts/`   | API-reference auto-gen from `vendor/spec` presets      |
| `Dockerfile` | production image (nginx + Mintlify export)             |

## Submodule: API spec

```bash
git submodule add https://github.com/happycastle114/datari-spec.git vendor/spec
git submodule update --init --recursive
npm run gen:api-reference   # reads vendor/spec/presets/**/*.yaml
```

## Local dev

```bash
npm install
npm run dev    # mintlify dev server on :3000
```

## CI / release flow

1. Push to `main` → build Mintlify, build nginx image, push to NCR
2. Workflow `digest-bump.yml` opens a PR in `happycastle114/datari-gitops`
3. ArgoCD auto-syncs once the gitops PR merges

## Sister repos

- `happycastle114/datari-spec`   — OpenAPI presets + codegen (submodule)
- `happycastle114/datari-api`    — gateway
- `happycastle114/datari-web`    — landing + dashboard
- `happycastle114/datari-gitops` — ArgoCD GitOps single-writer
- `happycastle114/datari-infra`  — Terraform IaC

## License

Private. © DATA BRIDGE.
