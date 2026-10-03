import { describe, expect, it } from "vitest";
import {
  splitIdentifiers,
  toFunction,
  toIngredient,
  toSubstance,
} from "../src/mapping";
import type { CosingRawMetadata, CosingSearchResult } from "../src/types/raw";

const RETRIEVED_AT = "2026-10-03T18:29:48.000Z";

function result(metadata: CosingRawMetadata): CosingSearchResult {
  return {
    apiVersion: "2.155",
    reference: "d3549992-4b93-41f4-ba3b-358659973fcc",
    url: "urn:test",
    contentType: "text/plain",
    language: "en",
    database: "GROWTH_COSING",
    databaseLabel: "Growth Cosmetic Ingredients and Substances",
    summary: "",
    content: "",
    accessRestriction: false,
    metadata,
  };
}

describe("splitIdentifiers", () => {
  it("splits ' / '-joined identifier strings", () => {
    expect(splitIdentifiers("68-26-8 / 11103-57-4")).toEqual([
      "68-26-8",
      "11103-57-4",
    ]);
  });

  it("returns [] for '-', empty and whitespace-only values", () => {
    expect(splitIdentifiers("-")).toEqual([]);
    expect(splitIdentifiers("")).toEqual([]);
    expect(splitIdentifiers("  ")).toEqual([]);
    expect(splitIdentifiers(undefined)).toEqual([]);
  });

  it("trims spaces around values", () => {
    expect(splitIdentifiers(" 68-26-8 /  11103-57-4 ")).toEqual([
      "68-26-8",
      "11103-57-4",
    ]);
  });
});

describe("toIngredient", () => {
  const retinol = result({
    inciName: ["RETINOL"],
    nameOfCommonIngredientsGlossary: ["RETINOL"],
    casNo: ["68-26-8 / 11103-57-4"],
    ecNo: ["200-683-7 / 234-328-2"],
    substanceId: ["37479"],
    itemType: ["ingredient"],
    functionName: ["SKIN CONDITIONING - MISCELLANEOUS"],
    status: ["Active"],
    perfuming: ["N"],
    officialJournalPublication: ["Y"],
    identifiedIngredient: ["104250"],
    chemicalDescription: [
      "Retinol is the primary naturally occurring form of vitamin A",
    ],
  });

  it("maps the complete useful identity projection", () => {
    const match = toIngredient(retinol, {
      retrievedAt: RETRIEVED_AT,
      matchedOn: "inciName",
      exact: true,
    });
    const ingredient = match.item;
    expect(ingredient.substanceId).toBe("37479");
    expect(ingredient.inciName).toBe("RETINOL");
    expect(ingredient.casNumbers).toEqual(["68-26-8", "11103-57-4"]);
    expect(ingredient.ecNumbers).toEqual(["200-683-7", "234-328-2"]);
    expect(ingredient.rawCasNumber).toBe("68-26-8 / 11103-57-4");
    expect(ingredient.functions).toEqual(["SKIN CONDITIONING - MISCELLANEOUS"]);
    expect(ingredient.perfuming).toBe(false);
    expect(ingredient.officialJournalPublication).toBe(true);
    expect(match.matchedOn).toBe("inciName");
    expect(match.exact).toBe(true);
  });

  it("carries provenance: source id, link, retrieval time", () => {
    const { item } = toIngredient(retinol, {
      retrievedAt: RETRIEVED_AT,
      matchedOn: "text",
      exact: false,
    });
    expect(item.source).toEqual({
      database: "GROWTH_COSING",
      id: "37479",
      url: "https://ec.europa.eu/growth/tools-databases/cosing/details/37479",
      retrievedAt: RETRIEVED_AT,
    });
  });

  it("keeps missing data unknown instead of inventing it", () => {
    const bare = result({ substanceId: ["1"], itemType: ["ingredient"] });
    const { item } = toIngredient(bare, {
      retrievedAt: RETRIEVED_AT,
      matchedOn: "text",
      exact: false,
    });
    expect(item.status).toBeUndefined();
    expect(item.inciName).toBeUndefined();
    expect(item.casNumbers).toEqual([]);
    expect(item.perfuming).toBeUndefined();
    expect(item.raw).toBe(bare.metadata);
  });

  it("keeps regulatory and scientific references separate", () => {
    const withRefs = result({
      substanceId: ["1"],
      itemType: ["ingredient"],
      sccsOpinion: ["Opinion on Retinol"],
      sccsOpinionUrls: ["https://health.ec.europa.eu/document/example"],
      relatedRegulations: ["(EU) 2024/996"],
      cosmeticRestriction: ["0.3% retinol equivalent"],
    });
    const { item } = toIngredient(withRefs, {
      retrievedAt: RETRIEVED_AT,
      matchedOn: "text",
      exact: false,
    });
    expect(item.sccsOpinions).toEqual(["Opinion on Retinol"]);
    expect(item.sccsOpinionUrls).toEqual([
      "https://health.ec.europa.eu/document/example",
    ]);
    expect(item.relatedRegulations).toEqual(["(EU) 2024/996"]);
    expect(item.cosmeticRestriction).toBe("0.3% retinol equivalent");
  });
});

describe("toSubstance", () => {
  it("preserves annex-scoped regulatory fields", () => {
    const substance = result({
      substanceId: ["104250"],
      itemType: ["substance"],
      inciName: ["RETINOL"],
      annexNo: ["III"],
      refNo: ["376"],
      maximumConcentration: ["0.05% retinol equivalent (body lotion)"],
      productTypeBodyParts: ["Body lotion"],
      wordingOfConditions: [
        "Contains Vitamin A. Consider your daily intake before use",
      ],
      cosmeticRestriction: ["0.3% RE"],
      status: ["Active"],
    });
    const { item } = toSubstance(substance, {
      retrievedAt: RETRIEVED_AT,
      matchedOn: "annex",
      exact: true,
    });
    expect(item.itemType).toBe("substance");
    expect(item.annexNumbers).toEqual(["III"]);
    expect(item.refNo).toBe("376");
    expect(item.maximumConcentration).toBe(
      "0.05% retinol equivalent (body lotion)",
    );
    expect(item.productTypeBodyParts).toBe("Body lotion");
    expect(item.wordingOfConditions).toBe(
      "Contains Vitamin A. Consider your daily intake before use",
    );
  });
});

describe("toFunction", () => {
  it("maps function vocabulary records", () => {
    const fn = result({
      itemType: ["function"],
      functionId: ["101"],
      functionName: ["ADHESIVE"],
      functionDescription: ["Tending to unite/bind/bond surfaces together."],
    });
    const { item } = toFunction(fn, {
      retrievedAt: RETRIEVED_AT,
      matchedOn: "substanceId",
      exact: true,
    });
    expect(item.functionId).toBe("101");
    expect(item.name).toBe("ADHESIVE");
    expect(item.description).toBe(
      "Tending to unite/bind/bond surfaces together.",
    );
    expect(item.source.id).toBe("101");
    expect(item.source.url).toBe(
      "https://ec.europa.eu/growth/tools-databases/cosing/reference/functions/list/ADHESIVE",
    );
  });
});
