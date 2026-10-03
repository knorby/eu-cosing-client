import { parseAnnexCsv } from "./annex-csv";
import { MAX_PAGE_SIZE, MAX_SEARCH_PAGES } from "./constants";
import type { CosingClientConfig, RequestOptions } from "./http";
import { CosingRequester } from "./http";
import { toFunction, toIngredient, toSubstance } from "./mapping";
import { CosingSearchTransport } from "./search-transport";
import type { AnnexEntryForMap, AnnexExport, AnnexId } from "./types/annex";
import type {
  CosingFunction,
  CosingIngredient,
  CosingMatch,
  CosingMatchField,
  CosingPage,
  CosingSubstance,
} from "./types/ingredient";
import type {
  CosingSearchClause,
  CosingSearchResponse,
  CosingSortClause,
} from "./types/raw";

export type { CosingClientConfig };

const ANNEX_IDS: readonly AnnexId[] = ["II", "III", "IV", "V", "VI"];

function assertPage(page: number): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError(`\`page\` must be a positive integer, got ${page}`);
  }
}

function assertPageSize(pageSize: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(
      `\`pageSize\` must be an integer between 1 and ${MAX_PAGE_SIZE}, got ${pageSize}`,
    );
  }
}

function assertAnnexId(annex: string): asserts annex is AnnexId {
  if (!(ANNEX_IDS as readonly string[]).includes(annex)) {
    throw new RangeError(
      `\`annex\` must be one of ${ANNEX_IDS.join(", ")} (Regulation (EC) No 1223/2009 annexes), got ${JSON.stringify(annex)}`,
    );
  }
}

/** True when the raw `" / "`-joined (or `/`/`;` mixed) string contains the identifier. */
function identifierMatches(
  rawJoined: string | undefined,
  target: string,
): boolean {
  if (!rawJoined) return false;
  const normalized = target.trim().toLowerCase();
  if (rawJoined.trim().toLowerCase() === normalized) return true;
  return rawJoined
    .split(/[/;]/u)
    .map((part) => part.trim().toLowerCase())
    .includes(normalized);
}

function toPage<T>(
  response: CosingSearchResponse,
  map: (result: CosingSearchResponse["results"][number]) => CosingMatch<T>,
): CosingPage<T> {
  return {
    items: response.results.map(map),
    page: response.pageNumber,
    pageSize: response.pageSize,
    total: response.totalResults,
    hasMore: response.pageNumber * response.pageSize < response.totalResults,
  };
}

/** Search criteria accepted by `ingredients.search`. */
export interface IngredientSearchCriteria {
  /** Fuzzy full-text search (the web app's search box). */
  text?: string;
  /** Exact INCI name, e.g. `"RETINOL"`. */
  inciName?: string;
  /** Exact Common Ingredients Glossary name. */
  glossaryName?: string;
  /**
   * CAS number, full or partial (`"68-26-8"`). The source stores
   * multi-value CAS as one joined string, so this is matched via fuzzy
   * text search plus a client-side post-filter on the split values.
   */
  casNo?: string;
  /** EC number, full or partial — matched like `casNo`. */
  ecNo?: string;
  /** Exact function name filter. */
  functionName?: string;
  /** Inventory status value, e.g. `"Active"` (current/historical flag). */
  status?: string;
  /** 1-based page number. Default 1. */
  page?: number;
  /** Page size, 1–500. Default 20. */
  pageSize?: number;
}

export interface SearchAllOptions {
  /** Page size used for each fetch. Default 20, max 500. */
  pageSize?: number;
  signal?: AbortSignal;
}

/** Search criteria accepted by `substances.search`. */
export interface SubstanceSearchCriteria {
  text?: string;
  /** Annex number, e.g. `"III"`. */
  annex?: string;
  /** Reference number within the annex (may be lettered, e.g. `"2a"`). */
  refNo?: string;
  casNo?: string;
  ecNo?: string;
  page?: number;
  pageSize?: number;
}

export class IngredientsNamespace {
  constructor(
    private readonly requester: CosingRequester,
    private readonly transport: CosingSearchTransport,
    private readonly functions: () => FunctionsNamespace,
  ) {}

  async search(
    criteria: IngredientSearchCriteria & RequestOptions,
  ): Promise<CosingPage<CosingIngredient>> {
    const page = criteria.page ?? 1;
    const pageSize = criteria.pageSize ?? this.requester.pageSize;
    assertPage(page);
    assertPageSize(pageSize);

    const clauses: CosingSearchClause[] = [
      { term: { itemType: "ingredient" } },
    ];
    if (criteria.inciName)
      clauses.push({ term: { inciName: criteria.inciName } });
    if (criteria.glossaryName) {
      clauses.push({
        term: { nameOfCommonIngredientsGlossary: criteria.glossaryName },
      });
    }
    if (criteria.functionName) {
      clauses.push({ term: { functionName: criteria.functionName } });
    }
    if (criteria.status) clauses.push({ term: { status: criteria.status } });

    // Identifiers ride the fuzzy text parameter (term matching cannot hit
    // partial values inside " / "-joined strings); everything else follows.
    const text = criteria.casNo ?? criteria.ecNo ?? criteria.text ?? "";

    const response = await this.transport.search({
      text,
      clauses,
      page,
      pageSize,
      signal: criteria.signal,
    });

    let matchedOn: CosingMatchField = "text";
    let exact = false;
    if (criteria.inciName) {
      matchedOn = "inciName";
      exact = true;
    } else if (criteria.casNo) {
      matchedOn = "casNo";
      exact = true;
    } else if (criteria.ecNo) {
      matchedOn = "ecNo";
      exact = true;
    } else if (criteria.glossaryName) {
      matchedOn = "glossaryName";
      exact = true;
    } else if (criteria.functionName) {
      matchedOn = "functionName";
      exact = true;
    } else if (criteria.status) {
      matchedOn = "status";
      exact = true;
    }

    const retrievedAt = new Date().toISOString();
    const result = toPage(response, (result) =>
      toIngredient(result, { retrievedAt, matchedOn, exact }),
    );

    if (criteria.casNo || criteria.ecNo) {
      const target = criteria.casNo ?? criteria.ecNo ?? "";
      const raw = criteria.casNo
        ? (match: CosingMatch<CosingIngredient>) => match.item.rawCasNumber
        : (match: CosingMatch<CosingIngredient>) => match.item.rawEcNumber;
      result.items = result.items.filter((match) =>
        identifierMatches(raw(match), target),
      );
    }
    return result;
  }

  async get(
    substanceId: string,
    options: RequestOptions = {},
  ): Promise<CosingMatch<CosingIngredient> | null> {
    const response = await this.transport.search({
      clauses: [
        { term: { itemType: "ingredient" } },
        { term: { substanceId } },
      ],
      signal: options.signal,
    });
    const first = response.results[0];
    if (!first) return null;
    return toIngredient(first, {
      retrievedAt: new Date().toISOString(),
      matchedOn: "substanceId",
      exact: true,
    });
  }

  /**
   * Functions assigned to an ingredient, joined with vocabulary
   * definitions. Names the vocabulary does not contain are omitted —
   * nothing is invented. Two searches: the ingredient record plus the
   * function vocabulary.
   */
  async getFunctions(
    substanceId: string,
    options: RequestOptions = {},
  ): Promise<CosingFunction[]> {
    const record = await this.get(substanceId, options);
    if (!record) return [];
    const assigned = record.item.functions;
    if (assigned.length === 0) return [];
    const vocabulary: CosingFunction[] = [];
    for await (const match of this.functions().listAll({
      pageSize: MAX_PAGE_SIZE,
    })) {
      vocabulary.push(match.item);
    }
    return vocabulary.filter((fn) => assigned.includes(fn.name));
  }

  async *searchAll(
    criteria: IngredientSearchCriteria,
    options: SearchAllOptions = {},
  ): AsyncGenerator<CosingMatch<CosingIngredient>> {
    for (let page = 1; page <= MAX_SEARCH_PAGES; page++) {
      const result = await this.search({
        ...criteria,
        page,
        pageSize: options.pageSize,
        signal: options.signal,
      });
      yield* result.items;
      if (!result.hasMore) return;
    }
  }
}

export class FunctionsNamespace {
  constructor(
    private readonly requester: CosingRequester,
    private readonly transport: CosingSearchTransport,
  ) {}

  async list(
    options: { page?: number; pageSize?: number } & RequestOptions = {},
  ): Promise<CosingPage<CosingFunction>> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? this.requester.pageSize;
    assertPage(page);
    assertPageSize(pageSize);
    const response = await this.transport.search({
      clauses: [{ term: { itemType: "function" } }],
      page,
      pageSize,
      signal: options.signal,
    });
    return toPage(response, (result) =>
      toFunction(result, {
        retrievedAt: new Date().toISOString(),
        matchedOn: "none",
        exact: true,
      }),
    );
  }

  async get(
    name: string,
    options: RequestOptions = {},
  ): Promise<CosingMatch<CosingFunction> | null> {
    const response = await this.transport.search({
      clauses: [
        { term: { itemType: "function" } },
        { term: { functionName: name } },
      ],
      signal: options.signal,
    });
    const first = response.results[0];
    if (!first) return null;
    return toFunction(first, {
      retrievedAt: new Date().toISOString(),
      matchedOn: "functionName",
      exact: true,
    });
  }

  async *listAll(
    options: SearchAllOptions = {},
  ): AsyncGenerator<CosingMatch<CosingFunction>> {
    for (let page = 1; page <= MAX_SEARCH_PAGES; page++) {
      const result = await this.list({
        page,
        pageSize: options.pageSize,
        signal: options.signal,
      });
      yield* result.items;
      if (!result.hasMore) return;
    }
  }
}

export class SubstancesNamespace {
  constructor(
    private readonly requester: CosingRequester,
    private readonly transport: CosingSearchTransport,
  ) {}

  async search(
    criteria: SubstanceSearchCriteria & RequestOptions,
  ): Promise<CosingPage<CosingSubstance>> {
    const page = criteria.page ?? 1;
    const pageSize = criteria.pageSize ?? this.requester.pageSize;
    assertPage(page);
    assertPageSize(pageSize);
    const clauses: CosingSearchClause[] = [{ term: { itemType: "substance" } }];
    if (criteria.annex) clauses.push({ term: { annexNo: criteria.annex } });
    if (criteria.refNo) clauses.push({ term: { refNo: criteria.refNo } });
    const text = criteria.casNo ?? criteria.ecNo ?? criteria.text ?? "";
    const response = await this.transport.search({
      text,
      clauses,
      page,
      pageSize,
      signal: criteria.signal,
    });
    let matchedOn: CosingMatchField = "text";
    let exact = false;
    if (criteria.refNo) {
      matchedOn = "refNo";
      exact = true;
    } else if (criteria.annex) {
      matchedOn = "annex";
      exact = true;
    } else if (criteria.casNo) {
      matchedOn = "casNo";
      exact = true;
    } else if (criteria.ecNo) {
      matchedOn = "ecNo";
      exact = true;
    }
    const retrievedAt = new Date().toISOString();
    const result = toPage(response, (result) =>
      toSubstance(result, { retrievedAt, matchedOn, exact }),
    );
    if (criteria.casNo || criteria.ecNo) {
      const target = criteria.casNo ?? criteria.ecNo ?? "";
      const raw = criteria.casNo
        ? (match: CosingMatch<CosingSubstance>) => match.item.rawCasNumber
        : (match: CosingMatch<CosingSubstance>) => match.item.rawEcNumber;
      result.items = result.items.filter((match) =>
        identifierMatches(raw(match), target),
      );
    }
    return result;
  }

  async *searchAll(
    criteria: SubstanceSearchCriteria,
    options: SearchAllOptions = {},
  ): AsyncGenerator<CosingMatch<CosingSubstance>> {
    for (let page = 1; page <= MAX_SEARCH_PAGES; page++) {
      const result = await this.search({
        ...criteria,
        page,
        pageSize: options.pageSize,
        signal: options.signal,
      });
      yield* result.items;
      if (!result.hasMore) return;
    }
  }
}

export class AnnexesNamespace {
  constructor(private readonly requester: CosingRequester) {}

  /** Raw CSV text of an annex export, unparsed. */
  async download(
    annex: AnnexId,
    options: RequestOptions = {},
  ): Promise<string> {
    assertAnnexId(annex);
    return this.requester.getText(
      `${this.requester.exportApiUrl}/annexes/${annex}/export-csv`,
      options,
    );
  }

  /** Downloads and parses an annex export into typed entries. */
  async get<A extends AnnexId>(
    annex: A,
    options: RequestOptions = {},
  ): Promise<AnnexExport<AnnexEntryForMap[A]>> {
    const csv = await this.download(annex, options);
    return parseAnnexCsv<AnnexId>(csv, {
      annex,
      retrievedAt: new Date().toISOString(),
    }) as AnnexExport<AnnexEntryForMap[A]>;
  }
}

export class RawNamespace {
  constructor(private readonly transport: CosingSearchTransport) {}

  /**
   * Raw source-native search escape hatch: direct access to the EU Search
   * transport for queries the curated namespaces do not express. Returns
   * the unmodified API response.
   */
  search(options: {
    text?: string;
    clauses: CosingSearchClause[];
    sort?: CosingSortClause[];
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
  }): Promise<CosingSearchResponse> {
    return this.transport.search(options);
  }
}

/**
 * Typed client for the European Commission's CosIng database.
 *
 * ```ts
 * const client = new CosingClient({ apiKey: "…" });
 * const page = await client.ingredients.search({ text: "retinol" });
 * ```
 *
 * Unofficial, not affiliated with the European Commission. CosIng is an
 * informative, non-binding reference database; this client returns data,
 * not medical or legal advice.
 */
export class CosingClient {
  private readonly requester: CosingRequester;
  private readonly searchTransport: CosingSearchTransport;

  /** Inventory ingredient search and retrieval. */
  readonly ingredients: IngredientsNamespace;
  /** Ingredient function vocabulary. */
  readonly functions: FunctionsNamespace;
  /** Regulatory substance search (Annex entries). */
  readonly substances: SubstancesNamespace;
  /** Annex II–VI export acquisition and parsing. */
  readonly annexes: AnnexesNamespace;
  /** Raw source-native escape hatch. */
  readonly raw: RawNamespace;

  constructor(config: CosingClientConfig = {}) {
    this.requester = new CosingRequester(config);
    this.searchTransport = new CosingSearchTransport(this.requester);
    this.functions = new FunctionsNamespace(
      this.requester,
      this.searchTransport,
    );
    this.ingredients = new IngredientsNamespace(
      this.requester,
      this.searchTransport,
      () => this.functions,
    );
    this.substances = new SubstancesNamespace(
      this.requester,
      this.searchTransport,
    );
    this.annexes = new AnnexesNamespace(this.requester);
    this.raw = new RawNamespace(this.searchTransport);
  }
}
