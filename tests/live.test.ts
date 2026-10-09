import { describe, expect, it } from "vitest";
import { CosingClient } from "../src/client";

/**
 * Live smoke tests — opt-in, never run in CI.
 *
 * ```bash
 * COSING_LIVE_TESTS=1 COSING_API_KEY=<key> npm run test:live
 * ```
 *
 * Annex tests need no API key. Search tests additionally need
 * `COSING_API_KEY`. Expectations are loose (counts, not exact payloads) so
 * routine upstream data updates do not break the tripwire; structural
 * regressions (empty results, unparseable exports) still fail loudly.
 */
const RUN_LIVE = process.env.COSING_LIVE_TESTS === "1";
const API_KEY = process.env.COSING_API_KEY;
const itLive = RUN_LIVE ? it : it.skip;
const itSearch = RUN_LIVE && API_KEY ? it : it.skip;
const TIMEOUT = 60_000;

describe("live smoke — annexes (no key required)", () => {
  itLive(
    "downloads and parses Annex II as prohibited entries",
    { timeout: TIMEOUT },
    async () => {
      const client = new CosingClient();
      const export_ = await client.annexes.get("II");
      expect(export_.kind).toBe("prohibited");
      expect(export_.entries.length).toBeGreaterThan(1000);
      expect(export_.fileCreationDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/u);
      expect(export_.retrievedAt).toBeTruthy();
    },
  );

  itLive(
    "downloads and parses Annex III as restricted entries with conditions",
    { timeout: TIMEOUT },
    async () => {
      const client = new CosingClient();
      const export_ = await client.annexes.get("III");
      expect(export_.kind).toBe("restricted");
      const retinol = export_.entries.find(
        (entry) => entry.referenceNumber === "376",
      );
      expect(retinol).toBeTruthy();
      expect(retinol?.casNumbers).toContain("68-26-8");
      expect(retinol?.wordingOfConditionsAndWarnings).toContain("Vitamin A");
      expect(retinol?.maximumConcentration).toBeTruthy();
    },
  );
});

describe("live smoke — search (requires COSING_API_KEY)", () => {
  itSearch(
    "finds RETINOL by exact INCI name",
    { timeout: TIMEOUT },
    async () => {
      const client = new CosingClient({ apiKey: API_KEY });
      const page = await client.ingredients.search({ inciName: "RETINOL" });
      expect(page.total).toBeGreaterThan(0);
      const exact = page.items.find(
        (match) => match.item.inciName === "RETINOL",
      );
      expect(exact).toBeTruthy();
      expect(exact?.exact).toBe(true);
      expect(exact?.item.source.url).toContain("/details/");
    },
  );

  itSearch(
    "retrieves retinol by stable substance ID",
    { timeout: TIMEOUT },
    async () => {
      const client = new CosingClient({ apiKey: API_KEY });
      const match = await client.ingredients.get("37479");
      expect(match?.item.substanceId).toBe("37479");
      expect(match?.item.casNumbers).toContain("68-26-8");
    },
  );

  itSearch(
    "finds ingredients by partial CAS via the wildcard clause",
    { timeout: TIMEOUT },
    async () => {
      const client = new CosingClient({ apiKey: API_KEY });
      const page = await client.ingredients.search({ casNo: "68-26-8" });
      expect(page.items.length).toBeGreaterThan(0);
      for (const match of page.items) {
        expect(match.item.casNumbers).toContain("68-26-8");
        expect(match.matchedOn).toBe("casNo");
        expect(match.exact).toBe(false);
      }
    },
  );

  itSearch(
    "resolves an identified-ingredient substance ID to a substance record",
    { timeout: TIMEOUT },
    async () => {
      const client = new CosingClient({ apiKey: API_KEY });
      const substance = await client.substances.get("104250");
      expect(substance?.matchedOn).toBe("substanceId");
      expect(substance?.exact).toBe(true);
      expect(substance?.item.refNo).toBe("376");
      expect(substance?.item.annexNumbers).toContain("III");
    },
  );

  itSearch("lists the function vocabulary", { timeout: TIMEOUT }, async () => {
    const client = new CosingClient({ apiKey: API_KEY });
    const page = await client.functions.list();
    expect(page.total).toBeGreaterThan(50);
    expect(page.items[0].item.name).toBeTruthy();
  });
});
