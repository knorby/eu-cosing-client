# Contributing

Thanks for contributing! This guide covers getting set up, the development
workflow, and how to publish releases.

## Prerequisites

- **Node.js 24+** (use [nvm](https://github.com/nvm-sh/nvm) or
  [fnm](https://github.com/Schniz/fnm); this repo includes an `.nvmrc`)
- **npm** (bundled with Node)
- **pre-commit** — `pipx install pre-commit` or `brew install pre-commit`
- **gitleaks** — `brew install gitleaks` (secret scanner for pre-commit)
- **Go toolchain** — `brew install go` (required once for the TruffleHog hook
  build)

## Getting started

```bash
git clone https://github.com/knorby/eu-cosing-client.git
cd eu-cosing-client
nvm use              # or: fnm use
npm install          # installs deps (prepare blocked by .npmrc ignore-scripts)
npx husky            # sets up Husky hooks (run after npm install)
pre-commit install   # sets up pre-commit hooks for file hygiene + secrets
```

## Development commands

| Command | What it does |
| --- | --- |
| `npm run build` | Build the package (tsup + tsc — dual ESM/CJS output with `.d.ts`/`.d.cts` declarations) |
| `npm run dev` | Build in watch mode |
| `npm run lint` | Lint + formatting check with Biome (read-only) |
| `npm run format` | Format with Biome (writes changes) |
| `npm run check` | Lint + format in one pass (writes changes) |
| `npm run typecheck` | Type-check `src/` + `tests/` with `tsc` (no emit) |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage reporting |
| `npm run test:live` | Run opt-in CosIng smoke tests; search tests require `COSING_API_KEY` |
| `npm run version:packages` | Consume changesets and refresh package-lock metadata |

## Git hooks

This repo uses **two** git hook managers that complement each other:

1. **pre-commit** — file hygiene (whitespace, EOL, YAML/JSON validation),
   secret scanning (gitleaks + TruffleHog), and shellcheck. Enforces
   `no-commit-to-branch` to protect `main`/`master`.

2. **Husky** — TypeScript-specific checks on staged files:
   - `pre-commit`: runs `lint-staged` (Biome format + lint on staged files
     only)
   - `commit-msg`: runs `commitlint` to enforce
     [conventional commits](https://www.conventionalcommits.org/)

You need both for full coverage:
```bash
pre-commit install
npx husky   # prepare script is blocked by .npmrc ignore-scripts=true
```

## Commit messages

This repo enforces [conventional commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`,
`perf`, `ci`.

Examples:
```
feat(auth): add token refresh logic
fix: handle null response from API
docs: update README with publish instructions
```

## Versioning and releases

This repo uses [Changesets](https://github.com/changesets/changesets) for
versioning. Versioning is **decoupled from merges** — you can merge multiple
PRs and release them all at once.

### Adding a changeset

Every PR that changes published output should include a changeset:

```bash
npx changeset
```

Select the bump type (patch/minor/major) and write a short summary. A new
`.md` file appears in `.changeset/` — commit it alongside your code.

### Releasing

Follow [docs/releasing.md](docs/releasing.md) for the initial local 0.1.0
publish, GitHub/npm setup, and later releases. The installed workflow at
`.github/workflows/release.yml` is disabled until the repository variable
`NPM_RELEASE_ENABLED` equals `true` and only runs release jobs on `main`.

Once enabled, Changesets selects one of three modes:

- Pending changesets: open/update a version PR using `npm run version:packages`,
  which updates the version, changelog, and lockfile together.
- No changesets and an unpublished version: run quality gates, build, pack,
  and publish through OIDC; create the tag and GitHub release.
- No changesets and the current version already published: no-op.

The initial release is already versioned at 0.1.0. Its included work is in
`CHANGELOG.md`, with no pending bump. Do not run `version:packages` to seed
that version; use the guide's explicit tarball publish instead.

### Before publishing, always verify

```bash
npm run build
npm pack --dry-run    # verify only dist/, README.md, CHANGELOG.md, LICENSE
```

## Publishing security

- **Trusted publishing (OIDC)** — the release workflow publishes with an OIDC
  token minted by GitHub Actions; there are no npm tokens (no `NPM_TOKEN`
  secret). Compatible with 2FA (`npm profile enable-2fa auth-and-writes`)
  because no token needs an OTP.
- **Provenance** — `publishConfig.provenance: true` enables attestation for
  CI releases from the public repository. Override with `--provenance=false`
  only for the initial local publish; leave the committed setting intact.
- **Scoped name** — `@knorby/eu-cosing-client` uses the owner's namespace;
  `publishConfig.access: "public"` is set because scoped
  packages default to restricted visibility.
- **No secrets in the package** — the `files` field in `package.json`
  whitelists only `dist`, `README.md`, `CHANGELOG.md`, and `LICENSE`.

## Pull request process

1. Create a branch from `main`.
2. Make your changes + add a changeset (`npx changeset`).
3. Ensure all checks pass: `npm run lint && npm run typecheck && npm test &&
   npm run build`.
4. Open a PR against `main`. CI runs lint, typecheck, build, test, and
   `npm audit`, plus the pre-commit suite (file hygiene + secret scanning).
5. After review, merge. Release separately via changesets.
