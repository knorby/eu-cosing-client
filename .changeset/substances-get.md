---
"@knorby/eu-cosing-client": minor
---

Add `client.substances.get(substanceId)` for resolving the substance IDs carried on `CosingIngredient.identifiedIngredientIds` to full substance records (annex number, reference number, verbatim conditions). Returns `null` when the source has no such record; empty is not an error.
