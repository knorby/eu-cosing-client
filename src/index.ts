/**
 * @knorby/eu-cosing-client — a universal TypeScript client for the European
 * Commission's CosIng cosmetic ingredient database.
 *
 * Unofficial and not affiliated with the European Commission. CosIng is an
 * informative, non-binding reference database: this client returns source
 * data, not medical or legal advice. Only Regulation (EC) No 1223/2009 and
 * its Annexes establish legal status and conditions of use.
 */

export { parseAnnexCsv } from "./annex-csv";
export type {
  IngredientSearchCriteria,
  SearchAllOptions,
  SubstanceSearchCriteria,
} from "./client";
export {
  AnnexesNamespace,
  CosingClient,
  FunctionsNamespace,
  IngredientsNamespace,
  RawNamespace,
  SubstancesNamespace,
} from "./client";
export {
  cosingDetailUrl,
  DEFAULT_EXPORT_API_URL,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SEARCH_API_URL,
  DEFAULT_TIMEOUT_MS,
  MAX_PAGE_SIZE,
  MAX_SEARCH_PAGES,
  SEARCH_DATABASE,
} from "./constants";
export type { CosingErrorOptions } from "./errors";
export {
  CosingApiError,
  CosingConfigError,
  CosingError,
  CosingNetworkError,
  CosingParseError,
  CosingTimeoutError,
} from "./errors";
export type {
  CosingClientConfig,
  FetchLike,
  RequestOptions,
  RetryOn429Options,
} from "./http";
export { CosingRequester, redactApiKey } from "./http";
export {
  splitIdentifiers,
  toFunction,
  toIngredient,
  toSubstance,
} from "./mapping";
export type { MultipartBody, MultipartPart } from "./multipart";
export { buildMultipartBody, randomBoundary } from "./multipart";
export type { CosingSearchOptions } from "./search-transport";
export { CosingSearchTransport } from "./search-transport";
export type {
  AnnexEntry,
  AnnexEntryForMap,
  AnnexEntryKind,
  AnnexExport,
  AnnexId,
  AnnexIIEntry,
  AnnexIIIEntry,
  AnnexIVEntry,
  AnnexVEntry,
  AnnexVIEntry,
} from "./types/annex";
export type {
  CosingFunction,
  CosingIngredient,
  CosingMatch,
  CosingMatchField,
  CosingMatchOptions,
  CosingPage,
  CosingRecordBase,
  CosingSourceRef,
  CosingSubstance,
} from "./types/ingredient";
export type {
  CosingRawMetadata,
  CosingSearchClause,
  CosingSearchResponse,
  CosingSearchResult,
  CosingSortClause,
} from "./types/raw";
export { VERSION } from "./version";
