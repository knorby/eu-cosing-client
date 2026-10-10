# ADR-0001: Ship the public EU Search key as the default

- **Status:** Proposed
- **Date:** 2026-10-10

## Context

CosIng ingredient search runs through the Commission's generic EU Search
service, which rejects keyless requests (HTTP 400 when the `apiKey` query
parameter is absent; HTTP 500 for empty or invalid values — verified by
direct probing on 2026-10-10). The only key in existence is a static,
public application key the CosIng web app serves to every browser in its
world-readable runtime configuration
([`env-json-config.json`](https://ec.europa.eu/growth/tools-databases/cosing/assets/env-json-config.json)).
There is no signup, developer portal, or registration flow; the key is an
index/application selector in the same family as the Funding & Tenders
Portal's documented `apiKey=SEDIA`, not a per-user credential.

Until now this client required every consumer to pass `apiKey` themselves.
That was friction with no benefit: the only value a user could supply is the
same public key the client could have shipped, so users ended up digging it
out of the web app's configuration by hand. Full evidence and probe results:
`docs/superpowers/2026-10-10-api-key-evaluation.md` (git-ignored scratch —
the probe table above is its summary).

## Decision

1. Ship the public key as `DEFAULT_SEARCH_API_KEY` in `src/constants.ts` and
   resolve it in `CosingRequester` whenever `config.apiKey` is unset. Search
   works with `new CosingClient()` and no configuration. An explicitly empty
   `apiKey` string still fails fast with a `CosingConfigError` explaining the
   override semantics.
2. Append a rotation hint to search error messages on HTTP 400/500, since a
   redeployed web app may ship a new key and every default-config consumer
   would start failing.
3. Add a manual, dev-only `npm run check:search-key` script that compares
   the shipped constant against the live `env-json-config.json` (one
   unauthenticated GET, honest User-Agent, never scheduled in CI, never
   published in the npm package). Live smoke tests run search against the
   default key so rotation also surfaces there.
4. Keep the key out of "user-managed credential" framing in docs: the README
   states there is nothing to register for and the override exists for
   rotation, not for personal keys.

## Consequences

- **Rotation risk:** the default may go stale after a web-app redeploy.
  Mitigations: the 400/500 error hint, `check:search-key`, and the live
  suite. A stale default is a patch release away from fixed.
- **Reuse terms:** the Commission does not document third-party reuse terms
  for the public key. Shipping it is the same posture as the web app itself
  and existing third-party clients (e.g. RewardedIvan/cosIng-api, which
  takes the same key from its callers), but it is a judgment call: the
  maintainer accepts it by flipping this record to Accepted.
- **Secret-scanning:** the constant trips gitleaks' `generic-api-key` rule
  and carries a line-scoped `gitleaks:allow` annotation. That annotation is
  for this public constant only and must never be copied onto a real
  credential.
- **Not chosen:** runtime fetching of the web app config (breaks
  universal-runtime/CORS constraints and sends third-party traffic to the
  web-app host) and CI-scheduled key polling (unattended polling of EC
  infrastructure is a posture change this decision deliberately avoids).
