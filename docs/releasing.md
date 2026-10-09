# Releasing @knorby/eu-cosing-client

The first npm release is **0.1.0**, published locally from the merged source.
Later releases use Changesets and GitHub OIDC. Publishing, changing repository
visibility, merging, tagging, and pushing are maintainer actions; this guide
does not grant an agent permission to perform them.

## Safety switch

`.github/workflows/release.yml` is installed, but all release jobs are disabled
unless the **repository variable** `NPM_RELEASE_ENABLED` is exactly `true`.
Release jobs also require `refs/heads/main`, including manual dispatches.
Leave the variable unset while preparing and merging the initial PR.

## First release: ordered checklist

### 1. Prepare the initial PR

- Keep `package.json` at `0.1.0`. Its unpublished changes, including
  `substances.get`, belong in the existing 0.1.0 changelog.
- There must be no pending `.changeset/*.md` bump files for included work
  (`README.md` is documentation, not a bump).
- Keep package-lock version and engine metadata consistent with package.json.
- Resolve the full dependency audit, including development dependencies.
- Keep `publishConfig.access: "public"` and `publishConfig.provenance: true`.

Do not run `changeset version`, `version:packages`, or `npm version` to seed
the already prepared 0.1.0: that would change the version intended for release.

### 2. Validate and review public disclosure

Use Node 24 from `.nvmrc` for development/release tooling. Node >=18 is the
consumer runtime requirement, not the build-tool requirement.

```bash
nvm use
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
npm pack --dry-run
```

Require the Tests and Pre-commit workflows to pass on the PR. Review the
entire Git history for credentials and private material before making it
public: a gitignored file can still have been committed in the past.
Review fixture attribution and the software license separately from EU data
reuse rights. Planning directories should never be tracked.

The package may contain only `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`,
and npm's automatically included `package.json`. Source maps under `dist/`
contain source text; inspect them for disclosure too. Fixtures and local
planning documents are not part of the tarball.

### 3. Make the repository public and merge

After the disclosure review, change visibility in GitHub Settings → General
→ Danger Zone. Merge the initial PR only after its required checks pass.
Keep `NPM_RELEASE_ENABLED` unset.

```bash
git switch main
git pull --ff-only origin main
git status --short
npm pkg get name version engines
```

Confirm a clean checkout, the intended merged commit, package name
`@knorby/eu-cosing-client`, and version `0.1.0`.

### 4. Authenticate and check npm

```bash
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
npm view @knorby/eu-cosing-client versions --json --registry=https://registry.npmjs.org
```

Use the account that owns the `@knorby` scope and enable npm account 2FA.
A 404 for a not-yet-created package is expected. Authentication/network errors
are not evidence that a version is available. Stop if `0.1.0` already exists;
published versions cannot be overwritten.

### 5. Build, inspect, and publish the exact tarball

Repeat the checks in step 2 on merged `main`, then:

```bash
npm pack
tar -tzf knorby-eu-cosing-client-0.1.0.tgz
npm publish ./knorby-eu-cosing-client-0.1.0.tgz --access public --tag latest --provenance=false --registry=https://registry.npmjs.org
```

Use a current npm CLI and complete its interactive 2FA prompt. Explicitly
building is necessary because `.npmrc` blocks lifecycle scripts. Publishing
the inspected tarball avoids rebuilding different contents at publish time.

The CLI flag overrides `publishConfig.provenance` for this publish only.
Do not delete and restore package metadata. A local first release has no CI
provenance; later OIDC releases from this public repository will have it.

```bash
npm view @knorby/eu-cosing-client@0.1.0 version dist.integrity --registry=https://registry.npmjs.org
npm view @knorby/eu-cosing-client dist-tags --json --registry=https://registry.npmjs.org
```

Confirm `latest` points to 0.1.0. Install that version in a separate consumer
project and test ESM/CJS imports and TypeScript resolution; test Expo/Metro
in the application when applicable. Registry replication may take time.

### 6. Tag the published source and create its GitHub release

From the unchanged merged checkout used to build the artifact, check that
`v0.1.0` does not already exist locally or remotely. Then:

```bash
git tag -a v0.1.0 -m "Release 0.1.0"
git push origin v0.1.0
gh release create v0.1.0 --verify-tag --title "v0.1.0" --notes-file CHANGELOG.md
```

Tag the source commit, not a later automation/configuration commit. Direct
`npm publish` does not create tags. Do not force-update an existing release tag.

## Enable automated releases after seeding npm

1. In GitHub Settings → Actions → General, allow Actions to create pull
   requests. The workflow grants write permissions only to the jobs that need
   them; leave default repository token permissions read-only.
2. Create GitHub environment `release`. Restrict deployments to `main` and
   add approval protection if desired.
3. In the npm package's Settings → Trusted publishing, configure GitHub:

   | Field | Value |
   | --- | --- |
   | Organization/user | `knorby` |
   | Repository | `eu-cosing-client` |
   | Workflow filename | `release.yml` (filename only, not a path) |
   | Environment | `release` |
   | Allowed actions | Allow direct `npm publish` |

   No stored npm publishing token is required. The publish job uses
   GitHub-hosted runners, Node 24, npm >=11.5.1, and `id-token: write`.
   A newly configured publisher must complete its first successful publish
   within two days; configure it near the next real release or recreate it
   if it expires. A no-op workflow run does not validate the publisher.
4. Set GitHub Settings → Secrets and variables → Actions → Variables →
   **Repository variable** `NPM_RELEASE_ENABLED` to `true`.
5. Dispatch Release on `main`. With 0.1.0 already published and no pending
   changesets, the expected mode is `none`; no publication occurs.

For future releases, add a changeset with each change to published output.
Merging it selects version mode and opens/updates a version PR. The action
runs `npm run version:packages`, refreshing the changelog, version, and
lockfile. Review and verify that PR before merging. PRs created with the
default GitHub token may not trigger other Actions workflows automatically;
do not mistake missing checks for successful checks. Validate the branch
locally or arrange CI validation before merging.

Merging the version PR selects publish mode if the version is absent from
npm. The pack job runs lint, typecheck, tests, the full audit, and build before
packing. The publish job uses that artifact, then creates tags and GitHub
releases. Release jobs do not use dependency caches or stored npm tokens.

Set the variable to `false` to disable future release runs. This does not
cancel a run already in progress; cancel it separately if necessary.

## Recovery

- **Wrong version before publishing:** stop and correct the release PR;
  do not publish an unintended bump.
- **OIDC authentication failure:** check owner/repository, filename,
  environment, direct-publish permission, publisher expiry, and CLI version.
- **Audit failure:** update affected dependencies, review the lockfile diff,
  and rerun all gates. Keep the full audit threshold intact.
- **Partial publish/tag failure:** inspect npm and GitHub state first. Retry
  only missing steps; do not overwrite versions or force-update tags.
- **Local provenance failure:** use the explicit `--provenance=false` flag
  for seeding; CI requires a public repository for provenance.

## References

- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
- [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish)
- [Changesets v2 actions](https://github.com/changesets/action/tree/v2)
