/**
 * Verified CosIng endpoint defaults and limits.
 *
 * These were verified by read-only probing on 2026-10-03. They describe
 * the public surfaces the web app itself uses; the Commission does not
 * publish an SLA for them. Both can be overridden in client config.
 */

/**
 * The Commission's generic EU Search service, used by the public CosIng web
 * app for all search operations. Requires an API key (query parameter).
 */
export const DEFAULT_SEARCH_API_URL =
  "https://webgate.ec.europa.eu/es/search-api/rest/search";

/**
 * Open export API: annex CSV/XLS downloads, ingredient/regulation PDFs.
 * No authentication; GET only (HEAD returns 405).
 */
export const DEFAULT_EXPORT_API_URL =
  "https://api.tech.ec.europa.eu/cosing20/1.0/api";

/** Default per-attempt request timeout. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default page size for search requests. */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Maximum page size accepted by the search API (the web app requests up to
 * 500 results per page).
 */
export const MAX_PAGE_SIZE = 500;

/**
 * Hard safety cap on pages fetched by the `*All` async-generator helpers.
 * Full-inventory mirroring is explicitly out of scope for this client.
 */
export const MAX_SEARCH_PAGES = 500;

/** Search database label returned by the EU Search API. */
export const SEARCH_DATABASE = "GROWTH_COSING";

/** Stable public detail-page URL for a CosIng substance ID. */
export function cosingDetailUrl(substanceId: string): string {
  return `https://ec.europa.eu/growth/tools-databases/cosing/details/${substanceId}`;
}
