# Changesets

Changesets manage versioning and changelogs for this package. Each change is
recorded as a markdown file in this directory; when you're ready to release,
changesets consumes them to bump the version and generate the changelog.

## Workflow

1. **Make your code changes** (feature, bugfix, etc.) on a branch.
2. **Create a changeset** describing the change:
   ```bash
   npx changeset
   ```
   Select patch / minor / major, write a short summary. A new `.md` file
   appears in `.changeset/` — commit it alongside your code.
3. **Open a PR** with both the code change and the changeset file.
4. **Release** using the [release runbook](../docs/releasing.md). Once enabled,
   `.github/workflows/release.yml` opens a version PR and publishes on its merge.
   `npm run version:packages` updates versions, changelogs, and the lockfile
   together; automation calls it for you.

The initial 0.1.0 is already versioned and includes its pre-publication fixes.
Do not add or consume another bump for that initial release. Keep the repository
variable `NPM_RELEASE_ENABLED` unset until npm is seeded and OIDC is configured.

The `.md` files in this directory are consumed and deleted by `changeset version`.
