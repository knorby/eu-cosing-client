---
"@knorby/eu-cosing-client": minor
---

Search works out of the box: the client now defaults to the public EU Search API key shipped by the CosIng web app (verified against its world-readable `env-json-config.json`; there is no registration flow for any other key). Pass `apiKey` only to override after a rotation — search errors on HTTP 400/500 now hint at that. Maintainers get `npm run check:search-key` to compare the shipped constant against the live config. See `docs/decisions/ADR-0001-ship-public-search-api-key.md` for the decision record.
