import { CosingApiError, CosingConfigError, CosingParseError } from "./errors";
import type { CosingRequester, RequestOptions } from "./http";
import { buildMultipartBody } from "./multipart";
import type {
  CosingSearchClause,
  CosingSearchResponse,
  CosingSortClause,
} from "./types/raw";

export interface CosingSearchOptions extends RequestOptions {
  /** Fuzzy full-text query (the web app's main search box). */
  text?: string;
  /** Exact-match filter clauses (Elasticsearch `term`/`terms` DSL). */
  clauses: CosingSearchClause[];
  /** Result sort; omitted means the API default (relevance). */
  sort?: CosingSortClause[];
  /** 1-based page number. Default 1. */
  page?: number;
  /** Page size (the API accepts up to 500). Defaults to the client page size. */
  pageSize?: number;
}

/**
 * Transport for the Commission's generic EU Search service — the only
 * public JSON search surface CosIng exposes (the dedicated JSON API behind
 * `api.tech.ec.europa.eu` requires internal EC authentication).
 *
 * Requests are multipart POSTs whose `query` part is an Elasticsearch-style
 * JSON blob; the API key travels as a URL query parameter and is redacted
 * from all client diagnostics.
 */
export class CosingSearchTransport {
  constructor(private readonly requester: CosingRequester) {}

  async search(options: CosingSearchOptions): Promise<CosingSearchResponse> {
    const key = this.requester.apiKey;
    if (!key) {
      throw new CosingConfigError(
        "CosIng search requires an EU Search API key. Pass `apiKey` when constructing the client. (The public web app ships one in its public browser configuration; third-party reuse terms are not documented.)",
      );
    }
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? this.requester.pageSize;
    // Built with encodeURIComponent (not URLSearchParams) to match the
    // observed web app transport exactly — the API's text parameter is
    // expected in %XX form.
    const params = [
      `apiKey=${encodeURIComponent(key)}`,
      `text=${encodeURIComponent(options.text ?? "")}`,
      `pageSize=${pageSize}`,
      `pageNumber=${page}`,
    ].join("&");
    const url = `${this.requester.searchApiUrl}?${params}`;
    const parts = [
      {
        name: "query",
        value: JSON.stringify({ bool: { must: options.clauses } }),
        contentType: "application/json",
      },
    ];
    if (options.sort && options.sort.length > 0) {
      parts.push({
        name: "sort",
        value: JSON.stringify(options.sort),
        contentType: "application/json",
      });
    }
    const { body, contentType } = buildMultipartBody(parts);
    const response = await this.requester.request(url, {
      method: "POST",
      body,
      headers: {
        "content-type": contentType,
        accept: "application/json",
      },
      signal: options.signal,
    });
    if (!response.ok) {
      const text = this.requester.redact(await response.text());
      const retryAfterHeader = response.headers.get("retry-after");
      throw new CosingApiError(
        `CosIng search responded ${response.status} for ${this.requester.redact(url)}`,
        {
          status: response.status,
          body: text,
          url: this.requester.redact(url),
          retryAfterSeconds: retryAfterHeader
            ? Number(retryAfterHeader)
            : undefined,
        },
      );
    }
    const text = await response.text();
    if (text.trim().length === 0) {
      throw new CosingParseError("CosIng search returned an empty body.", {
        bodySnippet: "",
      });
    }
    try {
      return JSON.parse(text) as CosingSearchResponse;
    } catch {
      throw new CosingParseError(
        "CosIng search returned a body that is not valid JSON.",
        { bodySnippet: this.requester.redact(text.slice(0, 200)) },
      );
    }
  }
}
