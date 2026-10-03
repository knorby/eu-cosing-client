/**
 * Raw source-native types — a 1:1 mirror of the EU Search API responses
 * used by the public CosIng web app, verified 2026-10-03.
 *
 * Field names are kept verbatim (including oddities like `casNo` storing a
 * single `" / "`-joined string) so they match observed payloads exactly.
 * Every metadata value in the source is an array; unknown/new fields pass
 * through untouched at runtime via the index signature.
 */

/** Search clause shapes accepted by the EU Search query DSL. */
export type CosingSearchClause =
  | { term: Record<string, string> }
  | { terms: Record<string, string[]> };

export interface CosingSortClause {
  field: string;
  order?: "asc" | "desc";
}

/** Metadata bag on every search result. All observed values are arrays. */
export interface CosingRawMetadata {
  /** INCI name, e.g. `"RETINOL"`. */
  inciName?: string[];
  /** Name from the Common Ingredients Glossary. */
  nameOfCommonIngredientsGlossary?: string[];
  /** International Nonproprietary Name. */
  innName?: string[];
  /** US INCI variant name. */
  inciUsaName?: string[];
  /** Pharmacopoeia name. */
  phEurName?: string[];
  /** Chemical name. */
  chemicalName?: string[];
  /** Free-text chemical description. */
  chemicalDescription?: string[];
  /** CAS number(s) as a single `" / "`-joined string, e.g. `"68-26-8 / 11103-57-4"`; `"-"` when absent. */
  casNo?: string[];
  /** EC number(s) as a single `" / "`-joined string; `"-"` when absent. */
  ecNo?: string[];
  /** Stable CosIng substance ID (string). */
  substanceId?: string[];
  /** Record kind: observed values `"ingredient"`, `"substance"`, `"function"`. */
  itemType?: string[];
  /** Ingredient function names assigned by the source. */
  functionName?: string[];
  /** Function vocabulary ID (function records). */
  functionId?: string[];
  /** Function vocabulary definition text (function records). */
  functionDescription?: string[];
  /** Annex numbers this entry appears in (substance records). */
  annexNo?: string[];
  /** Reference number within an annex (may be numeric or lettered parts). */
  refNo?: string[];
  refNo_digit?: string[];
  refNo_letter?: string[];
  /** Inventory status, e.g. `"Active"`. Current/historical flag — NOT biological activity. */
  status?: string[];
  /** `"Y"`/`"N"` perfuming flag. */
  perfuming?: string[];
  /** `"Y"`/`"N"` published-in-official-journal flag. */
  officialJournalPublication?: string[];
  /** CosIng substance IDs of identified ingredients linked to a substance entry. */
  identifiedIngredient?: string[];
  /** Restriction text (maximum concentration etc.). */
  cosmeticRestriction?: string[];
  otherRestrictions?: string[];
  maximumConcentration?: string[];
  productTypeBodyParts?: string[];
  wordingOfConditions?: string[];
  /** SCCS opinion titles. */
  sccsOpinion?: string[];
  /** SCCS opinion URLs. */
  sccsOpinionUrls?: string[];
  relatedRegulations?: string[];
  otherRegulations?: string[];
  classificationInformation?: string[];
  /** Colour (Annex IV colorant entries). */
  colour?: string[];
  note?: string[];
  other?: string[];
  currentVersion?: string[];
  /** Internal search-plumbing fields (`es*`, `datasource`, …) pass through here. */
  [key: string]: unknown;
}

/** A single search result. */
export interface CosingSearchResult {
  apiVersion: string;
  /** Stable UUID for the indexed record (distinct from `substanceId`). */
  reference: string;
  url: string;
  contentType: string;
  language: string;
  database: string;
  databaseLabel: string;
  summary: string;
  content: string;
  accessRestriction: boolean;
  metadata: CosingRawMetadata;
  enrichedMetadata?: Record<string, unknown>;
  children?: unknown[];
  highlightedFragments?: unknown[];
}

/** Full EU Search API response envelope. */
export interface CosingSearchResponse {
  apiVersion: string;
  terms: string;
  responseTime?: number;
  totalResults: number;
  pageNumber: number;
  pageSize: number;
  sort?: string;
  queryLanguage?: { language: string; probability: number };
  bestBets?: unknown[];
  results: CosingSearchResult[];
}
