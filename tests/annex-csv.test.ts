import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnnexCsv } from "../src/annex-csv";
import { CosingParseError } from "../src/errors";
import type { AnnexIIIEntry } from "../src/types/annex";

function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
}

const RETRIEVED_AT = "2026-10-03T18:29:48.000Z";

describe("parseAnnexCsv", () => {
  it("parses Annex II exports as prohibited entries with preamble dates", () => {
    const export_ = parseAnnexCsv(fixture("annex-ii.csv"), {
      annex: "II",
      retrievedAt: RETRIEVED_AT,
    });
    expect(export_.annex).toBe("II");
    expect(export_.kind).toBe("prohibited");
    expect(export_.fileCreationDate).toBe("03/10/2026");
    expect(export_.lastUpdateDate).toBe("29/09/2026");
    expect(export_.title).toBe(
      "LIST OF SUBSTANCES PROHIBITED IN COSMETIC PRODUCTS",
    );
    expect(export_.retrievedAt).toBe(RETRIEVED_AT);
    expect(export_.entries).toHaveLength(3);

    const first = export_.entries[0];
    expect(first.referenceNumber).toBe("1");
    expect(first.chemicalName).toBe("N-(5-Chlorobenzoxazol-2-yl)acetamide");
    expect(first.casNumbers).toEqual(["35783-57-4"]);
    expect(first.ecNumbers).toEqual([]); // "-" means absent
    expect(first.rawEcNumber).toBeUndefined();
    expect(first.regulation).toBe("(EC) 2009/1223");
    expect(first.updateDate).toBe("17/10/2010");

    const spironolactone = export_.entries[2];
    expect(spironolactone.referenceNumber).toBe("4");
    expect(spironolactone.identifiedIngredients).toBe("SPIRONOLACTONE");
  });

  it("parses Annex III as restricted entries, preserving multiline conditions verbatim", () => {
    const export_ = parseAnnexCsv(fixture("annex-iii.csv"), {
      annex: "III",
      retrievedAt: RETRIEVED_AT,
    });
    expect(export_.kind).toBe("restricted");
    expect(export_.entries).toHaveLength(2);

    const retinol = export_.entries[0] as AnnexIIIEntry;
    expect(retinol.referenceNumber).toBe("376");
    expect(retinol.glossaryName).toBe(
      "Retinol; Retinyl Acetate; Retinyl Palmitate",
    );
    // "11103-57-4/ 68-26-8; 127-47-9; 79-81-2" — mixed / and ; separators.
    expect(retinol.casNumbers).toEqual([
      "11103-57-4",
      "68-26-8",
      "127-47-9",
      "79-81-2",
    ]);
    expect(retinol.rawCasNumber).toBe("11103-57-4/ 68-26-8; 127-47-9; 79-81-2");
    expect(retinol.productTypeBodyParts).toContain("(a) Body lotion");
    expect(retinol.productTypeBodyParts).toContain(
      "(b) other leave-on and rinse-off products",
    );
    expect(retinol.maximumConcentration).toContain(
      "0,05 % Retinol Equivalent (RE)",
    );
    // The market-availability deadlines sit in "Other"; the labelling
    // warning is "Wording of conditions of use and warnings".
    expect(retinol.other).toContain("From 1 November 2025");
    expect(retinol.wordingOfConditionsAndWarnings).toContain(
      "Contains Vitamin A",
    );
    expect(retinol.regulation).toBe("(EU) 2024/996");
    expect(retinol.sccsOpinions).toContain("SCCS/1639/21");
    expect(retinol.updateDate).toBe("04/04/2024");
  });

  it("parses Annex IV as colorant entries with colour fields", () => {
    const export_ = parseAnnexCsv(fixture("annex-iv.csv"), {
      annex: "IV",
      retrievedAt: RETRIEVED_AT,
    });
    expect(export_.kind).toBe("colorant");
    const entry = export_.entries[0];
    expect(entry.referenceNumber).toBe("1");
    expect(entry.colourIndexNumber).toBe("CI 10006");
    expect(entry.color).toBe("Green");
    // Source quirk: in this Annex IV row the EC export stores the product
    // type ("Rinse-off product") in the maximum-concentration column. The
    // parser maps columns by header position and preserves the value
    // verbatim rather than second-guessing the source.
    expect(entry.maximumConcentration).toBe("Rinse-off product");
  });

  it("parses Annex V as preservative entries with uneven multi-identifier spacing", () => {
    const export_ = parseAnnexCsv(fixture("annex-v.csv"), {
      annex: "V",
      retrievedAt: RETRIEVED_AT,
    });
    expect(export_.kind).toBe("preservative");
    const entry = export_.entries[0];
    expect(entry.referenceNumber).toBe("1a"); // lettered reference numbers
    expect(entry.casNumbers).toHaveLength(12);
    expect(entry.casNumbers[0]).toBe("1863-63-4");
    expect(entry.casNumbers[1]).toBe("2090-05-3"); // "1863-63-4 /2090-05-3"
    expect(entry.maximumConcentration).toBe("0.5% (acid)");
  });

  it("parses Annex VI as uv-filter entries", () => {
    const export_ = parseAnnexCsv(fixture("annex-vi.csv"), {
      annex: "VI",
      retrievedAt: RETRIEVED_AT,
    });
    expect(export_.kind).toBe("uv-filter");
    const entry = export_.entries[0];
    expect(entry.referenceNumber).toBe("2");
    expect(entry.maximumConcentration).toBe("6%");
    expect(entry.glossaryName).toBe("Camphor benzalkonium methosulfate");
  });

  it("rejects a mismatch between the requested annex and the file preamble", () => {
    expect(() =>
      parseAnnexCsv(fixture("annex-ii.csv"), {
        annex: "III",
        retrievedAt: RETRIEVED_AT,
      }),
    ).toThrow(CosingParseError);
  });

  it("rejects content with no recognizable header row", () => {
    expect(() =>
      parseAnnexCsv("not,a,cosing,file\n1,2,3\n", {
        annex: "II",
        retrievedAt: RETRIEVED_AT,
      }),
    ).toThrow(CosingParseError);
  });

  it("keeps every entry kind distinct — no banned boolean flattening", () => {
    const kinds = (["II", "III", "IV", "V", "VI"] as const).map((annex) => {
      const file = `annex-${annex.toLowerCase()}.csv`;
      return parseAnnexCsv(fixture(file), { annex, retrievedAt: RETRIEVED_AT })
        .kind;
    });
    expect(kinds).toEqual([
      "prohibited",
      "restricted",
      "colorant",
      "preservative",
      "uv-filter",
    ]);
  });
});
