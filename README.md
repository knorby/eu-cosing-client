# @knorby/eu-cosing-client

A universal TypeScript client for the European Commission's **CosIng**
(**Cos**metic **Ing**redient) database — cosmetic ingredient identity
(INCI/CAS/EC), functions, and the regulatory Annexes of Regulation (EC) No
1223/2009, for Node tools and Expo/React Native apps.

> **This library is unofficial and not affiliated with, endorsed by, or
> supported by the European Commission or the European Union.** CosIng is an
> informative, non-binding reference database: inclusion in CosIng does not
> establish that an ingredient is approved for cosmetic use, and the data
> this client returns is **not medical advice**. Only Regulation (EC) No
> 1223/2009 and its Annexes — not CosIng — establish whether and under what
> conditions a substance may be used in cosmetic products. Always consult
> the operative legislation and qualified professionals before making
> decisions based on this data.

## About the data source

[CosIng](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en)
is the European Commission's cosmetic ingredient database. It contains
ingredient names and CAS/EC identifiers, ingredient functions, chemical
descriptions, scientific opinions (SCCS), and the restricted/prohibited
substance lists from the Annexes of the Cosmetics Regulation. Entries are
marked current or historical (status), and the database is updated
regularly.

**With gratitude to the European Commission** for publishing and maintaining
CosIng and for making its data available for reuse. EU-owned content on the
Commission's websites is generally licensed under
[CC BY 4.0](https://commission.europa.eu/legal-notice_en) — reuse is
permitted with appropriate credit and indication of changes; asset-specific
notices and exclusions may apply. Verify the current reuse notice before
redistributing CosIng-derived data. This client's *software* is Apache-2.0
and does not relicense the upstream data.

## Features

- **Guided, fully typed API** — search ingredients by free text or exact
  INCI/CAS/EC, retrieve records by stable source ID, browse the ingredient
  function vocabulary, and acquire + parse the Annex II–VI regulatory
  exports as structured entries.
- **Two layers** — curated typed projections (`CosingIngredient`,
  `CosingFunction`, `AnnexEntry`, …) plus a raw source-native access path
  for everything else.
- **Regulatory semantics preserved** — Annex II prohibition, Annex III
  conditional restriction, and unknown status stay distinct; concentration
  bases, conditions, warnings, and SCCS references are kept verbatim. No
  `banned: boolean` flattening, no invented fields.
- **Universal runtime** — works in Node ≥ 18, browsers (where CORS allows),
  and React Native/Expo; injectable `fetch`; the only runtime dependency is
  [`papaparse`](https://www.papaparse.com/) for the annex CSV exports.
- **Predictable errors** — typed error taxonomy separating timeouts, network
  failures, HTTP/API errors, parse failures, and configuration problems;
  empty results are empty arrays, never errors.
- **Provenance on every record** — source ID, source link, and retrieval
  time; source-supplied update dates are preserved and never replaced.

## Install

```bash
npm install @knorby/eu-cosing-client
```

## Quick start

```ts
import { CosingClient } from "@knorby/eu-cosing-client";

const client = new CosingClient({
  // Required for search: an EU Search API key (see "API keys" below).
  apiKey: process.env.COSING_API_KEY,
});

// Free-text search (fuzzy) — 17 retinol-ish results:
const fuzzy = await client.ingredients.search({ text: "retinol" });

// Exact INCI match — 1 result:
const exact = await client.ingredients.search({ inciName: "RETINOL" });

// Retrieve by stable CosIng substance ID:
const retinol = await client.ingredients.get("37479");

// Functions assigned by the source, with vocabulary definitions:
const fns = await client.ingredients.getFunctions("37479");
const vocabulary = await client.functions.listAll();

// Regulatory annexes (no API key needed):
const annexII = await client.annexes.get("II");
annexII.entries[0]; // { kind: "prohibited", referenceNumber: 1, casNumbers: [...], ... }
const annexIII = await client.annexes.get("III"); // kind: "restricted"
```

Search returns candidates with match metadata, so ambiguity is preserved:

```ts
const results = await client.ingredients.search({ text: "retinol" });
results.items[0].matchedOn; // "text" | "inciName" | "casNo" | ...
results.items[0].exact; // boolean — exact field match vs fuzzy/derived
```

## API keys

Ingredient search uses the Commission's generic **EU Search** service, which
requires an API key. The public CosIng web app ships one in its public
browser configuration; **the terms under which third parties may reuse that
key are not documented**, so this client never hardcodes it. Pass your own
key via `new CosingClient({ apiKey })`. Annex export methods work without a
key.

Requests embed the key in the URL query string; the client redacts it from
every error message and diagnostic it produces, but treat the key as
sensitive when logging raw traffic.

## Universal runtime notes

| Runtime | Support |
| --- | --- |
| Node ≥ 18 | ✅ full |
| React Native / Expo | ✅ full (inject `fetch` if your runtime lacks a global; RN's hermes provides one) |
| Browsers | ⚠️ subject to upstream CORS — browser failure is not proof of native failure |

- The client uses global `fetch`, `AbortController`, and `TextEncoder`, and
  injects `fetch` where needed: `new CosingClient({ fetch: myFetch })`.
- The search API requires `multipart/form-data`; rather than relying on
  React Native's historically flaky `FormData`/`Blob` upload behavior, the
  client serializes multipart bodies manually to an `ArrayBuffer` — this is
  invisible to consumers.
- The core runtime imports no Node builtins (`node:*`, `fs`, `path`, …).

## Pagination

Search methods accept `page` and `pageSize` and return `{ items, page,
pageSize, total, hasMore }`. For bounded bulk iteration, every search method
has an `*All` variant returning an async generator that yields individual
records, terminating on short pages or `total`, with a hard safety cap.

Annex exports are complete single-file CSVs — no pagination.

## Known source quirks

- **`text` vs `term` matching** — the `text` parameter is fuzzy full-text
  search; exact criteria (INCI, CAS, EC, status, function) are translated to
  the API's `term` filters. `ingredients.search({ casNo })` handles the
  split of multi-value identifier strings client-side and reports what
  matched.
- **Multi-value identifier strings** — CAS/EC numbers for an entry are
  stored as one `" / "`-joined string (e.g. `"68-26-8 / 11103-57-4"`). The
  curated types split these into arrays and preserve the raw string.
- **Array-valued metadata** — every search metadata field is an array in the
  source; curated types unwrap singletons but the raw layer preserves the
  shape 1:1.
- **Export endpoints only support GET** — HEAD requests return 405.
- **A private JSON API exists but requires internal EC auth** — this client
  uses only the public search + export surfaces.

## Testing

Deterministic offline tests run in CI with injected fetch mocks and
captured fixtures. Live smoke tests against the real endpoints are
opt-in and never run in CI:

```bash
COSING_LIVE_TESTS=1 COSING_API_KEY=<key> npm run test:live
```

## Development

| Command | What it does |
| --- | --- |
| `npm run build` | Build the package (tsup + tsc — dual ESM/CJS output with `.d.ts`/`.d.cts` declarations) |
| `npm run dev` | Build in watch mode |
| `npm run lint` | Lint + formatting check with Biome (read-only) |
| `npm run format` | Format with Biome (writes changes) |
| `npm run check` | Lint + format in one pass (writes changes) |
| `npm run typecheck` | Type-check `src/` + `tests/` with `tsc` (no emit) |
| `npm test` | Run tests once (Vitest) |
| `npm run test:live` | Run live smoke tests (requires `COSING_API_KEY`) |
| `npx changeset` | Create a changeset (required for changes affecting published output) |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## License

[Apache-2.0](LICENSE) © Kali Norby ([@knorby](https://github.com/knorby)).
CosIng data is © the European Commission (see the reuse notice above); this
license covers the client software only.
