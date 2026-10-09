# AGENTS.md

Instructions and steering for AI coding agents working in this repository.

This is `@knorby/eu-cosing-client`, a universal TypeScript client for the
European Commission's CosIng cosmetic ingredient database. It must remain
usable from Node and React Native/Expo consumers: no Node-only builtins in
the core runtime (`node:*`, `fs`, `path`, …), injectable `fetch`, and the
only runtime dependency is `papaparse`. Keep this file updated as
conventions evolve.

---

## Setup

### System requirements

Before installing git hooks, ensure the following are available on the
system:

1. **Node.js 24 (LTS)** — use [nvm](https://github.com/nvm-sh/nvm) or
   [fnm](https://github.com/Schniz/fnm); this repo includes an `.nvmrc`.
2. **npm** — bundled with Node.
3. **pre-commit** — install via `pipx install pre-commit` or
   `brew install pre-commit`. Handles file hygiene + secret scanning.
4. **gitleaks** — install via `brew install gitleaks` or see
   <https://github.com/gitleaks/gitleaks>. The hook uses the
   system-installed binary (`gitleaks-system` hook ID) for lightweight
   regex-based secret scanning.
5. **Go toolchain** — required for the TruffleHog hook, which pre-commit
   builds from source in an isolated GOPATH on first run (slow; cached
   afterward). Install via `brew install go` or see <https://go.dev/dl/>.
6. **shellcheck** is **not** a system dependency — `shellcheck-py` ships its
   own bundled binary.

### Install dependencies and hooks

```bash
nvm use                  # or: fnm use
npm install              # installs deps (does NOT run prepare — see .npmrc)
npx husky                # set up Husky hooks (blocked by ignore-scripts)
pre-commit install       # wire pre-commit hooks into .git/hooks/
pre-commit run --all-files  # validate against the entire repo
```

`npm install` does **not** run the `prepare` script because `.npmrc` sets
`ignore-scripts=true` (supply-chain security — blocks dependency postinstall
scripts). Run `npx husky` separately to set up the Husky-managed hooks
(pre-commit → lint-staged, commit-msg → commitlint). `pre-commit install`
separately sets up the pre-commit-managed hooks (file hygiene + secret
scanning). Both are needed for full coverage.

### Adding and removing hooks

- **Prefer existing hooks.** Always check the pre-commit hooks index
  (<https://pre-commit.com/hooks.html>) and the featured repositories
  (<https://pre-commit.com/hooks.html#featured-hooks>) before writing a custom
  hook. Existing, maintained hooks are preferred over custom ones.
- **If no existing hook can satisfy a requirement**, flag this in your output
  and request input before adding a custom hook.
- **TypeScript linting/formatting** is handled by **Biome** via Husky +
  lint-staged (see `.husky/pre-commit`). Do not add a TS linter to
  `.pre-commit-config.yaml`; use Husky/lint-staged for that.
- **TruffleHog**: replaceable with another secret scanner if preferred. Both
  gitleaks and TruffleHog run in pre-commit. If CI-based secret scanning is
  also desired (e.g. to catch secrets when hooks are skipped), add a workflow
  in `.github/workflows/` and document it here.
- **Hook revisions** are pinned. Bump deliberately and review changelogs.
- Reference: <https://pre-commit.com/hooks.html>

---

## Development commands

| Command | What it does |
| --- | --- |
| `npm run build` | Build the package (tsup + tsc — dual ESM/CJS output with `.d.ts`/`.d.cts` declarations) |
| `npm run dev` | Build in watch mode |
| `npm run lint` | Lint + formatting check with Biome (read-only) |
| `npm run format` | Format with Biome (writes changes) |
| `npm run check` | Lint + format in one pass (writes changes) |
| `npm run typecheck` | Type-check `src/` + `tests/` with `tsc` (uses `tsconfig.test.json`, no emit) |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage reporting |
| `npm run test:live` | Run live smoke tests against the real CosIng endpoints (requires `COSING_API_KEY`; opt-in, never in CI) |
| `npm run version:packages` | Consume changesets and refresh lockfile metadata (not for seeding the already-versioned 0.1.0) |
| `npx changeset` | Create a changeset (required for any change that affects published output) |

---

## Testing and CI

- Tests live in `tests/` and use **Vitest**. Add test files as
  `*.test.ts` alongside or under `tests/`.
- **GitHub Actions** runs the full check suite on every push to `main` and on
  PRs against `main` (see `.github/workflows/tests.yml`):
  - `npm run lint` (Biome — lint + formatting; formatting is enforced in CI,
    so run `npm run check` before committing if hooks are skipped)
  - `npm run typecheck` (tsc, src + tests)
  - `npm run build` (tsup)
  - `npm test` (Vitest)
  - `npm audit --audit-level=moderate` (vulnerability scan)
- The **pre-commit suite** (file hygiene + secret scanning) also runs in CI
  via `.github/workflows/pre-commit.yml` on every push to `main` and PRs
  against `main` (`pre-commit run --all-files --show-diff-on-failure` with
  `SKIP=no-commit-to-branch`, which would otherwise always fail on main pushes
  by design). The workflow installs a system gitleaks binary matching the rev
  in `.pre-commit-config.yaml`; the trufflehog golang hook uses the Go
  toolchain preinstalled on ubuntu-latest.
- Husky hooks (Biome + commitlint) remain local only.
- Optional security scanning additions (free for public repos): CodeQL
  (<https://github.com/github/codeql-action>), gitleaks-action
  (<https://github.com/gitleaks/gitleaks-action>), Semgrep
  (<https://github.com/returntocorp/semgrep-action>). Add workflows in
  `.github/workflows/` if desired and document them here.

---

## Versioning and publishing

This repo uses [Changesets](https://github.com/changesets/changesets) for
versioning. Versioning is **decoupled from merges** — you can merge multiple
PRs and release them all at once.

- **Before a PR that changes published output**: run `npx changeset`, select
  bump type (patch/minor/major), write a summary. Commit the generated
  `.changeset/*.md` file alongside the code change.
- **Release operations**: read [docs/releasing.md](docs/releasing.md) before
  first publishing, configuring trusted publishing, enabling automation, or
  retrying a failed release. Visibility, publishing, tags, and pushes require
  explicit user authorization; changing release files does not authorize them.
- **Versioning**: use `npm run version:packages` to consume changesets and
  refresh lockfile metadata together. The initial 0.1.0 is already versioned;
  include its pre-publication fixes in that changelog rather than bumping it.
- **GitHub Actions release** (`.github/workflows/release.yml`): installed,
  disabled until `NPM_RELEASE_ENABLED=true` is set as a repository variable.
  Release jobs also require `main`. Pending changesets select version mode;
  no changesets with an unpublished version select publish mode; an already
  published version selects no-op. The pack job runs the full checks and
  development-dependency audit before building the artifact. Only the publish
  job has `id-token: write`; Changesets actions are pinned to commit SHAs.
- **Always verify before publishing**: `npm run build && npm pack --dry-run`
  to confirm only `dist/`, `README.md`, `CHANGELOG.md`, and `LICENSE` are
  included.

### Initial release

Keep the release variable unset until the repository is public, the merged
0.1.0 has been published manually, and npm trusted publishing is configured.
Follow the ordered runbook in `docs/releasing.md`. The local publish uses
`--provenance=false`; keep `publishConfig.provenance: true` committed for CI.

### Release failure quick reference

| Symptom | Likely cause / fix |
| --- | --- |
| `EOTP` errors | A token is being used on a 2FA-enabled account — trusted publishing (no token) avoids this |
| `ENEEDAUTH` / 401 on publish | npm < 11.5.1 (the workflow upgrades npm), or the trusted-publisher config on npmjs.com does not match exactly (repo, workflow filename, environment) |
| "not permitted to create pull requests" | Enable "Allow GitHub Actions to create and approve pull requests" in Actions settings |
| Provenance warning `provider: null` | Published locally instead of via CI — provenance only works from CI on a public repo |
| 404 "package not found" right after publishing | npm registry replication lag — retry in a minute |

### Publishing security

- **Trusted publishing (OIDC)** — the release workflow publishes with an OIDC
  token minted by GitHub Actions; there are no npm tokens involved (no
  `NPM_TOKEN` or `NODE_AUTH_TOKEN` secrets). The npm-side trusted-publisher
  config must match the workflow exactly. This is compatible with 2FA
  (`npm profile enable-2fa auth-and-writes`) because no token needs an OTP.
- **Provenance** — `publishConfig.provenance: true` in `package.json` enables
  npm provenance attestation (cryptographic link to commit + workflow).
  Provenance requires publishing from CI on a **public** repository; the
  manual first publish overrides it on the CLI (see `docs/releasing.md`).
- **Scoped names** — use `@knorby/package`-style scoped names to prevent
  dependency confusion attacks. Scoped packages default to restricted
  visibility, so `publishConfig.access: "public"` is set.
- **No secrets in published files** — the `files` field in `package.json`
  whitelists only `dist`, `README.md`, `CHANGELOG.md`, and `LICENSE`. Never
  add `src/`, `.env`, `tsconfig.json`, or other config to the `files` list.
- **`.npmrc`** — `ignore-scripts=true` blocks dependency `postinstall`
  scripts by default (supply-chain security). This also blocks this repo's
  own `prepare` script, so `npm install` will not auto-set-up Husky hooks —
  run `npx husky` after `npm install`, or use
  `npm install --ignore-scripts=false` to allow the prepare script.

---

## Guardrails and steering rules

These rules are mandatory. Follow them strictly.

### Git operations

- Do **not** perform git write operations — `commit`, `push`, `amend`, `tag`,
  create PRs — unless explicitly asked by the user.

### File removal

- `rm` is intentionally blocked in this environment. Do **not** attempt to
  bypass this restriction (no `find -delete`, `python -c "os.remove(...)"`,
  shell tricks, or alternative deletion methods).
- Use `git rm` for tracked files that need removal.
- If untracked files need removal, or if your action is required to remove
  something, **stop** and flag what needs to be removed and why in your output.

### Documentation

- Keep `AGENTS.md` and `README.md` up to date as part of any change that
  affects setup, conventions, or project structure.
- Use the `docs/` directory for higher-level design notes, architecture, and
  decision records (ADRs). See `docs/README.md` for the ADR template.
- Treat `docs/` as living documentation. Create an ADR in `docs/decisions/`
  for significant design decisions.

### Before declaring done

- Run all quality gates:
  ```bash
  npm run lint && npm run typecheck && npm test && npm run build
  ```
- Verify that `npm pack --dry-run` includes only `dist/`, `README.md`,
  `CHANGELOG.md`, and `LICENSE` (no source, config, or secret files).
- Verify that `AGENTS.md` and `README.md` still reflect the current state of
  the repository.
