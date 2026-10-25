# Changelog

## 0.2.1

### Patch Changes

- e69f553: Restore automated releases: pending changesets open a Version Packages pull request again, the release jobs run on the Node version from `.nvmrc` with pinned actions, and publishing stays token-free through npm trusted publishing.

## 0.2.0

### Minor Changes

- 7b2aa4a: Search works out of the box: the client now defaults to the public EU Search API key shipped by the CosIng web app (verified against its world-readable `env-json-config.json`; there is no registration flow for any other key). Pass `apiKey` only to override after a rotation — search errors on HTTP 400/500 now hint at that. Maintainers get `npm run check:search-key` to compare the shipped constant against the live config. See `docs/decisions/ADR-0001-ship-public-search-api-key.md` for the decision record.

## 0.1.0

### Minor Changes

- ebb3b07: Initial release: a universal TypeScript client for the European Commission's CosIng cosmetic ingredient database.

  - Guided, typed API: `ingredients` (fuzzy text / exact INCI / wildcard CAS & EC search, get by substance ID, per-ingredient functions, async-generator pagination), `functions` (vocabulary list/get), `substances` (annex + reference-number search and get by substance ID), `annexes` (Annex II–VI CSV export download + parse with explicit regulatory kinds), and a `raw` escape hatch.
  - Resolve `CosingIngredient.identifiedIngredientIds` with `client.substances.get(id)`, returning a substance match or `null` when absent.
  - Two transports over one requester: EU Search multipart POST (injectable API key, redacted from all diagnostics) and the open export API (keyless GET).
  - Curated types with split multi-identifier strings, verbatim regulatory text (no `banned: boolean` flattening), source-scoped provenance (ID, link, retrieval time), plus a 1:1 raw layer.
  - Predictable error taxonomy: config / timeout / API / network / parse; empty results are empty, never errors.
  - Universal runtime: Node ≥ 18 and React Native/Expo, injectable `fetch`, no Node builtins in the shipped runtime; papaparse is the only runtime dependency.
  - Live-verified behavior (2026-10-03 probe): the source's wildcard query is used for CAS/EC lookup, matching the official web app's advanced search.

<!-- Changesets generates entries below this line. Do not edit manually. -->
