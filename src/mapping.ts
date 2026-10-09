/**
 * Raw → curated mapping functions. Every function is pure: it derives a
 * curated record from a raw search result plus match metadata, inventing
 * nothing that the source did not provide.
 */

import { cosingDetailUrl } from "./constants";
import type {
  CosingFunction,
  CosingIngredient,
  CosingMatch,
  CosingMatchOptions,
  CosingRecordBase,
  CosingSubstance,
} from "./types/ingredient";
import type { CosingSearchResult } from "./types/raw";

function first(values: string[] | undefined): string | undefined {
  const value = values?.[0];
  return value === undefined || value === "" ? undefined : value;
}

function listOf(values: string[] | undefined): string[] {
  return values ? [...values] : [];
}

function yesNo(values: string[] | undefined): boolean | undefined {
  const value = first(values);
  if (value === "Y") return true;
  if (value === "N") return false;
  return undefined;
}

/**
 * Splits a `" / "`-joined identifier string ("68-26-8 / 11103-57-4") into
 * individual values. `-`, empty and whitespace-only inputs yield `[]`.
 */
export function splitIdentifiers(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== "-");
}

function sourceRef(
  id: string,
  url: string,
  retrievedAt: string,
): CosingRecordBase["source"] {
  return { database: "GROWTH_COSING", id, url, retrievedAt };
}

function baseFields(
  result: CosingSearchResult,
  options: CosingMatchOptions,
  id: string,
  url: string,
): CosingRecordBase {
  const m = result.metadata;
  const rawCas = first(m.casNo);
  const rawEc = first(m.ecNo);
  return {
    substanceId: id,
    casNumbers: splitIdentifiers(rawCas),
    ecNumbers: splitIdentifiers(rawEc),
    rawCasNumber: rawCas === "-" ? undefined : rawCas,
    rawEcNumber: rawEc === "-" ? undefined : rawEc,
    inciName: first(m.inciName),
    glossaryName: first(m.nameOfCommonIngredientsGlossary),
    innName: first(m.innName),
    inciUsaName: first(m.inciUsaName),
    phEurName: first(m.phEurName),
    chemicalName: first(m.chemicalName),
    chemicalDescription: first(m.chemicalDescription),
    functions: listOf(m.functionName),
    status: first(m.status),
    perfuming: yesNo(m.perfuming),
    officialJournalPublication: yesNo(m.officialJournalPublication),
    cosmeticRestriction: first(m.cosmeticRestriction),
    otherRestrictions: listOf(m.otherRestrictions),
    sccsOpinions: listOf(m.sccsOpinion),
    sccsOpinionUrls: listOf(m.sccsOpinionUrls),
    relatedRegulations: listOf(m.relatedRegulations),
    otherRegulations: listOf(m.otherRegulations),
    notes: listOf(m.note),
    source: sourceRef(id, url, options.retrievedAt),
    raw: result.metadata,
  };
}

/** Maps a raw search result to a curated ingredient match. */
export function toIngredient(
  result: CosingSearchResult,
  options: CosingMatchOptions,
): CosingMatch<CosingIngredient> {
  const m = result.metadata;
  const id = first(m.substanceId) ?? "";
  const item: CosingIngredient = {
    ...baseFields(result, options, id, cosingDetailUrl(id)),
    itemType: "ingredient",
    identifiedIngredientIds: listOf(m.identifiedIngredient),
    annexNumbers: listOf(m.annexNo),
  };
  return { item, matchedOn: options.matchedOn, exact: options.exact };
}

/** Maps a raw search result to a curated substance match. */
export function toSubstance(
  result: CosingSearchResult,
  options: CosingMatchOptions,
): CosingMatch<CosingSubstance> {
  const m = result.metadata;
  const id = first(m.substanceId) ?? "";
  const item: CosingSubstance = {
    ...baseFields(result, options, id, cosingDetailUrl(id)),
    itemType: "substance",
    annexNumbers: listOf(m.annexNo),
    refNo: first(m.refNo),
    maximumConcentration: first(m.maximumConcentration),
    productTypeBodyParts: first(m.productTypeBodyParts),
    wordingOfConditions: first(m.wordingOfConditions),
  };
  return { item, matchedOn: options.matchedOn, exact: options.exact };
}

/** Maps a raw function-vocabulary search result to a curated function match. */
export function toFunction(
  result: CosingSearchResult,
  options: CosingMatchOptions,
): CosingMatch<CosingFunction> {
  const m = result.metadata;
  const id = first(m.functionId) ?? "";
  const name = first(m.functionName) ?? "";
  const item: CosingFunction = {
    functionId: id,
    name,
    description: first(m.functionDescription),
    source: sourceRef(
      id,
      `https://ec.europa.eu/growth/tools-databases/cosing/reference/functions/list/${encodeURIComponent(name)}`,
      options.retrievedAt,
    ),
  };
  return { item, matchedOn: options.matchedOn, exact: options.exact };
}
