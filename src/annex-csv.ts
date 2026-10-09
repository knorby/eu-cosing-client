/**
 * Parser for the official CosIng Annex II–VI CSV exports.
 *
 * The files are quoted CSV with a preamble (file creation date, annex name
 * and last-update date in DD/MM/YYYY, a title line, a section-header line),
 * a single header row, then data rows whose fields may contain embedded
 * newlines. Multiple CAS/EC identifiers are joined with a mix of `"/"` and
 * `";"` separators with inconsistent spacing. `-` marks absent values.
 *
 * The parser is pure: text in, structured export out. It invents nothing —
 * dates and regulatory text are preserved verbatim, and only the retrieval
 * timestamp (supplied by the caller) is added.
 */

import Papa from "papaparse";
import { CosingParseError } from "./errors";
import type {
  AnnexEntryBase,
  AnnexEntryForMap,
  AnnexEntryKind,
  AnnexExport,
  AnnexId,
} from "./types/annex";

const ANNEX_KIND: Record<AnnexId, AnnexEntryKind> = {
  II: "prohibited",
  III: "restricted",
  IV: "colorant",
  V: "preservative",
  VI: "uv-filter",
};

/** Value normalization: `-` and empty mean absent. */
function text(row: string[], index: number | undefined): string | undefined {
  if (index === undefined) return undefined;
  const value = row[index]?.trim() ?? "";
  if (value === "" || value === "-") return undefined;
  return value;
}

/**
 * Splits joined CAS/EC identifier strings on `/` and `;` separators.
 * Only used for identifier columns — names can legitimately contain `/`.
 */
function splitAnnexIdentifiers(value: string | undefined): {
  values: string[];
  raw: string | undefined;
} {
  if (value === undefined) return { values: [], raw: undefined };
  const values = value
    .split(/[/;]/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return { values, raw: value };
}

function findColumn(
  headers: string[],
  exact: string,
  prefix?: string,
): number | undefined {
  const index = headers.indexOf(exact);
  if (index >= 0) return index;
  if (prefix) {
    const prefixed = headers.findIndex((header) => header.startsWith(prefix));
    if (prefixed >= 0) return prefixed;
  }
  return undefined;
}

interface Preamble {
  fileCreationDate?: string;
  lastUpdateDate?: string;
  title?: string;
  annexName?: string;
}

function parsePreamble(rows: string[][]): Preamble {
  const preamble: Preamble = {};
  for (const row of rows) {
    for (const cell of row) {
      const value = cell.trim();
      const creation = /^File creation date:\s*(.+)$/u.exec(value);
      if (creation) {
        preamble.fileCreationDate = creation[1]?.trim();
        continue;
      }
      const update = /^Last update:\s*(.+)$/u.exec(value);
      if (update) {
        preamble.lastUpdateDate = update[1]?.trim();
        continue;
      }
      const annexName = /^ANNEX (II|III|IV|V|VI)$/u.exec(value);
      if (annexName) {
        preamble.annexName = annexName[1];
        continue;
      }
      // A lone non-empty cell in a single-cell row before the header row
      // that is not a date/name is the title.
      if (row.length === 1 && value !== "" && preamble.title === undefined) {
        preamble.title = value;
      }
    }
  }
  return preamble;
}

/**
 * Parses an annex CSV export into a typed {@link AnnexExport}.
 *
 * @param text Raw CSV text from the export API.
 * @param options.annex The annex the caller requested; must match the
 *   file's own `ANNEX <id>` preamble (mismatches raise
 *   {@link CosingParseError} rather than returning wrong-typed entries).
 * @param options.retrievedAt ISO-8601 retrieval timestamp for provenance.
 */
export function parseAnnexCsv<A extends AnnexId>(
  csvText: string,
  options: { annex: A; retrievedAt: string },
): AnnexExport<AnnexEntryForMap[A]> {
  const cleaned = csvText.replace(/^\uFEFF/u, "");
  const parsed = Papa.parse<string[]>(cleaned, { skipEmptyLines: false });
  const rows = (parsed.data ?? []).filter(
    (row) =>
      Array.isArray(row) && row.some((cell) => (cell ?? "").trim() !== ""),
  );
  if (rows.length === 0) {
    throw new CosingParseError("Annex CSV contained no rows.", {
      bodySnippet: cleaned.slice(0, 200),
    });
  }

  const headerRowIndex = rows.findIndex(
    (row) => row[0]?.trim() === "Reference Number",
  );
  if (headerRowIndex < 0) {
    throw new CosingParseError(
      "Annex CSV contained no recognizable header row (expected a 'Reference Number' column).",
      { bodySnippet: cleaned.slice(0, 200) },
    );
  }
  const preamble = parsePreamble(rows.slice(0, headerRowIndex));
  if (
    preamble.annexName !== undefined &&
    preamble.annexName !== options.annex
  ) {
    throw new CosingParseError(
      `Annex mismatch: requested Annex ${options.annex} but the file declares Annex ${preamble.annexName}.`,
      { bodySnippet: `ANNEX ${preamble.annexName}` },
    );
  }

  const headers = rows[headerRowIndex]?.map((header) => header.trim()) ?? [];
  const column = {
    referenceNumber: findColumn(headers, "Reference Number"),
    chemicalName:
      findColumn(headers, "Chemical name / INN") ??
      findColumn(headers, "Chemical name"),
    glossaryName: findColumn(headers, "Name of Common Ingredients Glossary"),
    colourIndexNumber: findColumn(
      headers,
      "Colour index Number / Name of Common Ingredients Glossary",
    ),
    color: findColumn(headers, "Color"),
    cas: findColumn(headers, "CAS Number"),
    ec: findColumn(headers, "EC Number"),
    productType: findColumn(headers, "Product Type, body parts"),
    maxConcentration: findColumn(
      headers,
      "Maximum concentration in ready for use preparation",
    ),
    other: findColumn(headers, "Other"),
    wording: findColumn(headers, "Wording of conditions of use and warnings"),
    regulation: findColumn(headers, "Regulation"),
    otherDirectives: findColumn(headers, "Other Directives/Regulations"),
    sccsOpinions: findColumn(headers, "SCCS opinions"),
    iupacName: findColumn(headers, "Chemical/IUPAC Name"),
    identifiedIngredients: findColumn(
      headers,
      "Identified INGREDIENTS or substances e.g.",
      "Identified INGREDIENTS",
    ),
    cmr: findColumn(headers, "CMR"),
    updateDate: findColumn(headers, "Update Date"),
  };

  const kind = ANNEX_KIND[options.annex];
  const entries: AnnexEntryForMap[A][] = [];
  for (const row of rows.slice(headerRowIndex + 1)) {
    const cas = splitAnnexIdentifiers(text(row, column.cas));
    const ec = splitAnnexIdentifiers(text(row, column.ec));
    const base: AnnexEntryBase = {
      annex: options.annex,
      kind,
      referenceNumber: text(row, column.referenceNumber) ?? "",
      chemicalName: text(row, column.chemicalName),
      casNumbers: cas.values,
      ecNumbers: ec.values,
      rawCasNumber: cas.raw,
      rawEcNumber: ec.raw,
      regulation: text(row, column.regulation),
      otherDirectivesRegulations: text(row, column.otherDirectives),
      sccsOpinions: text(row, column.sccsOpinions),
      chemicalIupacName: text(row, column.iupacName),
      identifiedIngredients: text(row, column.identifiedIngredients),
      cmr: text(row, column.cmr),
      updateDate: text(row, column.updateDate),
    };
    const conditions =
      options.annex === "II"
        ? {}
        : {
            productTypeBodyParts: text(row, column.productType),
            maximumConcentration: text(row, column.maxConcentration),
            other: text(row, column.other),
            wordingOfConditionsAndWarnings: text(row, column.wording),
          };
    const annexSpecific =
      options.annex === "IV"
        ? {
            colourIndexNumber: text(row, column.colourIndexNumber),
            color: text(row, column.color),
          }
        : options.annex === "II"
          ? {}
          : { glossaryName: text(row, column.glossaryName) };
    entries.push({
      ...base,
      ...conditions,
      ...annexSpecific,
    } as AnnexEntryForMap[A]);
  }

  return {
    annex: options.annex,
    kind,
    title: preamble.title,
    fileCreationDate: preamble.fileCreationDate,
    lastUpdateDate: preamble.lastUpdateDate,
    entries,
    retrievedAt: options.retrievedAt,
  } as AnnexExport<AnnexEntryForMap[A]>;
}
