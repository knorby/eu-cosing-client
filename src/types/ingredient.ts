/**
 * Curated typed projections over the raw CosIng search results — type
 * definitions only. `src/mapping.ts` contains the raw→curated functions.
 * Curated records preserve every useful source fact, split multi-value
 * identifier strings, keep regulatory text verbatim, and carry provenance.
 * They never invent facts: absent source fields stay absent. The complete
 * raw metadata is always available on `item.raw`.
 */

import type { CosingRawMetadata } from "./raw";

/** Which criterion produced a match (SH-02: match reasons are explicit). */
export type CosingMatchField =
  | "text"
  | "inciName"
  | "glossaryName"
  | "casNo"
  | "ecNo"
  | "substanceId"
  | "functionName"
  | "annex"
  | "refNo"
  | "status"
  | "none";

export interface CosingMatchOptions {
  retrievedAt: string;
  matchedOn: CosingMatchField;
  /** Exact field match, vs fuzzy text match or client-side post-filter. */
  exact: boolean;
}
export interface CosingSourceRef {
  database: "GROWTH_COSING";
  /** Stable source-scoped ID (substance ID or function ID). */
  id: string;
  /** Public CosIng page for the record. */
  url: string;
  /** ISO-8601 timestamp captured when this record was retrieved. */
  retrievedAt: string;
}

/** A search candidate with explicit match metadata. */
export interface CosingMatch<T> {
  item: T;
  matchedOn: CosingMatchField;
  exact: boolean;
}

/** One page of search results. */
export interface CosingPage<T> {
  items: CosingMatch<T>[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/** Ingredient function vocabulary entry. */
export interface CosingFunction {
  functionId: string;
  name: string;
  description?: string;
  source: CosingSourceRef;
}

/** Common identity fields shared by ingredients and substances. */
export interface CosingRecordBase {
  substanceId: string;
  casNumbers: string[];
  ecNumbers: string[];
  /** Original `" / "`-joined CAS string, preserved verbatim. */
  rawCasNumber?: string;
  /** Original `" / "`-joined EC string, preserved verbatim. */
  rawEcNumber?: string;
  inciName?: string;
  glossaryName?: string;
  innName?: string;
  inciUsaName?: string;
  phEurName?: string;
  chemicalName?: string;
  chemicalDescription?: string;
  /** Functions the source assigns (names, not consumer categories). */
  functions: string[];
  /** Inventory status verbatim (e.g. "Active"). Current/historical flag — NOT biological activity. */
  status?: string;
  perfuming?: boolean;
  officialJournalPublication?: boolean;
  cosmeticRestriction?: string;
  otherRestrictions: string[];
  sccsOpinions: string[];
  sccsOpinionUrls: string[];
  relatedRegulations: string[];
  otherRegulations: string[];
  notes: string[];
  source: CosingSourceRef;
  /** Complete raw source metadata, untouched. */
  raw: CosingRawMetadata;
}

/** Inventory ingredient record (itemType "ingredient"). */
export interface CosingIngredient extends CosingRecordBase {
  itemType: "ingredient";
  /** CosIng substance IDs this ingredient is identified as (annex links). */
  identifiedIngredientIds: string[];
  /** Annex numbers the linked substance entries appear in. */
  annexNumbers: string[];
}

/** Regulatory substance record (itemType "substance"). */
export interface CosingSubstance extends CosingRecordBase {
  itemType: "substance";
  annexNumbers: string[];
  /** Reference number within the annex (may be lettered, e.g. "2a"). */
  refNo?: string;
  /** Maximum concentration, verbatim — bases (e.g. retinol equivalents) are not interchangeable with percentages. */
  maximumConcentration?: string;
  productTypeBodyParts?: string;
  /** Conditions of use and warnings, verbatim. */
  wordingOfConditions?: string;
}
