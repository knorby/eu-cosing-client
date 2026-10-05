# Changelog

## 0.1.0

### Minor Changes

- ebb3b07: Initial release: a universal TypeScript client for the European Commission's CosIng cosmetic ingredient database.

  - Guided, typed API: `ingredients` (fuzzy text / exact INCI / wildcard CAS & EC search, get by substance ID, per-ingredient functions, async-generator pagination), `functions` (vocabulary list/get), `substances` (annex + reference-number search), `annexes` (Annex II–VI CSV export download + parse with explicit regulatory kinds), and a `raw` escape hatch.
  - Two transports over one requester: EU Search multipart POST (injectable API key, redacted from all diagnostics) and the open export API (keyless GET).
  - Curated types with split multi-identifier strings, verbatim regulatory text (no `banned: boolean` flattening), source-scoped provenance (ID, link, retrieval time), plus a 1:1 raw layer.
  - Predictable error taxonomy: config / timeout / API / network / parse; empty results are empty, never errors.
  - Universal runtime: Node ≥ 18 and React Native/Expo, injectable `fetch`, no Node builtins in the shipped runtime; papaparse is the only runtime dependency.
  - Live-verified behavior (2026-10-03 probe): the source's wildcard query is used for CAS/EC lookup, matching the official web app's advanced search.

<!-- Changesets generates entries below this line. Do not edit manually. -->
