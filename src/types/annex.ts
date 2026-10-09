/**
 * Annex II–VI export types (parsed from the official CSV exports).
 *
 * Regulatory semantics are kept explicit: each annex has its own entry
 * type and `kind`, so Annex II prohibition, Annex III conditional
 * restriction, and allowed-with-conditions lists stay distinct. No
 * `banned: boolean` flattening — the Annexes are separate legal lists, and
 * absence from all of them is "unknown", not "allowed" or "prohibited".
 *
 * `kind` describes the source list, not a legal conclusion about any
 * product; only Regulation (EC) No 1223/2009 and its Annexes establish
 * what is permitted.
 */

/** Annex identifiers in Regulation (EC) No 1223/2009. */
export type AnnexId = "II" | "III" | "IV" | "V" | "VI";

/** The regulatory list an annex entry belongs to. */
export type AnnexEntryKind =
  | "prohibited" // Annex II
  | "restricted" // Annex III
  | "colorant" // Annex IV
  | "preservative" // Annex V
  | "uv-filter"; // Annex VI

/** Fields shared by every annex entry. Text is verbatim from the export. */
export interface AnnexEntryBase {
  /** Which annex this entry came from. */
  annex: AnnexId;
  /** Which regulatory list this entry belongs to. */
  kind: AnnexEntryKind;
  /** Reference number within the annex, verbatim — may be lettered ("2a"). */
  referenceNumber: string;
  /** "Chemical name / INN" (or "Chemical name" in Annex IV). */
  chemicalName?: string;
  /** Individual CAS numbers, split from the joined source string. */
  casNumbers: string[];
  /** Individual EC numbers, split from the joined source string. */
  ecNumbers: string[];
  /** Original joined CAS string, preserved verbatim. */
  rawCasNumber?: string;
  /** Original joined EC string, preserved verbatim. */
  rawEcNumber?: string;
  /** The regulation that introduced this entry, e.g. "(EC) 2009/1223". */
  regulation?: string;
  otherDirectivesRegulations?: string;
  /** SCCS opinion titles, verbatim (comma-joined in the source). */
  sccsOpinions?: string;
  chemicalIupacName?: string;
  /** Identified INGREDIENTS or substances (CMR-linked), verbatim. */
  identifiedIngredients?: string;
  /** CMR classification, verbatim. */
  cmr?: string;
  /** Source "Update Date", DD/MM/YYYY, verbatim. */
  updateDate?: string;
}

/** Conditions-of-use columns present in Annexes III–VI. */
export interface AnnexConditions {
  /** Product types / body parts the conditions apply to, verbatim (may contain newlines). */
  productTypeBodyParts?: string;
  /**
   * Maximum concentration in ready-for-use preparation, verbatim.
   * Bases are NOT interchangeable (e.g. "0,05 % Retinol Equivalent" ≠ a
   * mass percentage); never combine or compare these strings.
   */
  maximumConcentration?: string;
  other?: string;
  /** Wording of conditions of use and warnings, verbatim. */
  wordingOfConditionsAndWarnings?: string;
}

/** Annex II — list of substances prohibited in cosmetic products. */
export interface AnnexIIEntry extends AnnexEntryBase {
  annex: "II";
  kind: "prohibited";
}

/** Annex III — substances allowed only subject to restrictions. */
export interface AnnexIIIEntry extends AnnexEntryBase, AnnexConditions {
  annex: "III";
  kind: "restricted";
  glossaryName?: string;
}

/** Annex IV — colorants allowed in cosmetic products. */
export interface AnnexIVEntry extends AnnexEntryBase, AnnexConditions {
  annex: "IV";
  kind: "colorant";
  /** Colour index number / name column. */
  colourIndexNumber?: string;
  /** Color, e.g. "Green". */
  color?: string;
}

/** Annex V — preservatives allowed in cosmetic products. */
export interface AnnexVEntry extends AnnexEntryBase, AnnexConditions {
  annex: "V";
  kind: "preservative";
  glossaryName?: string;
}

/** Annex VI — UV filters allowed in cosmetic products. */
export interface AnnexVIEntry extends AnnexEntryBase, AnnexConditions {
  annex: "VI";
  kind: "uv-filter";
  glossaryName?: string;
}

/** Union of all annex entry shapes. */
export type AnnexEntry =
  | AnnexIIEntry
  | AnnexIIIEntry
  | AnnexIVEntry
  | AnnexVEntry
  | AnnexVIEntry;

/** Maps an annex to its specific entry type (used by `parseAnnexCsv`). */
export interface AnnexEntryForMap {
  II: AnnexIIEntry;
  III: AnnexIIIEntry;
  IV: AnnexIVEntry;
  V: AnnexVEntry;
  VI: AnnexVIEntry;
}

/** A parsed annex export. */
export interface AnnexExport<E extends AnnexEntry = AnnexEntry> {
  annex: AnnexId;
  kind: AnnexEntryKind;
  /** Preamble title line, e.g. "LIST OF SUBSTANCES PROHIBITED IN COSMETIC PRODUCTS". */
  title?: string;
  /** Preamble "File creation date" (DD/MM/YYYY, verbatim). */
  fileCreationDate?: string;
  /** Preamble "Last update" (DD/MM/YYYY, verbatim). */
  lastUpdateDate?: string;
  entries: E[];
  /** ISO-8601 timestamp captured when the file was retrieved. */
  retrievedAt: string;
}
