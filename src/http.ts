import {
  DEFAULT_EXPORT_API_URL,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SEARCH_API_URL,
  DEFAULT_TIMEOUT_MS,
} from "./constants";
import {
  CosingApiError,
  CosingConfigError,
  CosingNetworkError,
  CosingParseError,
  CosingTimeoutError,
} from "./errors";
import { VERSION } from "./version";

export type FetchLike = typeof globalThis.fetch;

/** Options for opt-in retry of 429 responses. */
export interface RetryOn429Options {
  /** Maximum number of retries after the initial attempt. Default 3. */
  maxRetries?: number;
  /** Backoff base in ms for responses without `Retry-After`. Default 1000. */
  initialBackoffMs?: number;
}

/**
 * Configuration accepted by `new CosingClient(...)`.
 *
 * - `apiKey` is required for search operations (the Commission's EU Search
 *   service rejects keyless requests); annex export methods work without it.
 * - `fetch` injection keeps the client usable in any runtime (tests,
 *   polyfills, React Native fetch shims).
 */
export interface CosingClientConfig {
  /**
   * EU Search API key. The public CosIng web app ships one in its public
   * browser configuration; the terms of third-party reuse are not
   * documented, so supply your own. Redacted from all diagnostics.
   */
  apiKey?: string;
  /** Override the EU Search endpoint (testing/proxy). */
  searchApiUrl?: string;
  /** Override the open export API base (testing/proxy). */
  exportApiUrl?: string;
  /** Per-attempt timeout in ms. Default 30000. */
  timeoutMs?: number;
  /** Injectable fetch implementation. Defaults to `globalThis.fetch`. */
  fetch?: FetchLike;
  /** Extra headers merged over the defaults (a `User-Agent` here wins). */
  headers?: Record<string, string>;
  /** Default `User-Agent` is `@knorby/eu-cosing-client/<version>`. */
  userAgent?: string;
  /** Opt in to automatic retry of 429 responses. Off by default. */
  retryOn429?: boolean | RetryOn429Options;
}

export interface RequestOptions {
  /** Caller-owned cancellation. Combined with the per-attempt timeout. */
  signal?: AbortSignal;
}

interface ResolvedConfig {
  apiKey: string | undefined;
  searchApiUrl: string;
  exportApiUrl: string;
  timeoutMs: number;
  headers: Record<string, string>;
  retry: Required<RetryOn429Options> | undefined;
  pageSize: number;
}

const RETRY_DELAY_CAP_MS = 60_000;

/**
 * Replaces every occurrence of `key` (raw or percent-encoded) with `***`.
 * Deliberately over-matches: redacting too much is safe, too little is not.
 */
export function redactApiKey(text: string, key: string | undefined): string {
  if (!key || key.length === 0) return text;
  const pattern = [...key]
    .map((char) => {
      const hex = char.charCodeAt(0).toString(16).toUpperCase();
      return [char, `%${hex}`, `%${hex.toLowerCase()}`]
        .map((alt) => alt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    })
    .map((alternation) => `(?:${alternation})`)
    .join("");
  return text.replace(new RegExp(pattern, "g"), "***");
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const asDate = Date.parse(trimmed);
  if (Number.isNaN(asDate)) return undefined;
  return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
}

/**
 * Low-level request dispatcher shared by both CosIng transports.
 * Handles fetch injection, per-attempt timeouts, caller cancellation,
 * opt-in 429 retry, and error mapping with API-key redaction.
 */
export class CosingRequester {
  private readonly fetchFn: FetchLike;
  private readonly config: ResolvedConfig;

  constructor(config: CosingClientConfig = {}) {
    const fn = config.fetch ?? globalThis.fetch?.bind(globalThis);
    if (typeof fn !== "function") {
      throw new CosingConfigError(
        "CosingRequester: no global `fetch` available in this runtime. Pass `fetch` in the client config.",
      );
    }
    this.fetchFn = fn;
    this.config = {
      apiKey: config.apiKey,
      searchApiUrl: config.searchApiUrl ?? DEFAULT_SEARCH_API_URL,
      exportApiUrl: config.exportApiUrl ?? DEFAULT_EXPORT_API_URL,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      headers: config.headers ?? {},
      retry: config.retryOn429
        ? {
            maxRetries:
              (typeof config.retryOn429 === "object"
                ? config.retryOn429.maxRetries
                : undefined) ?? 3,
            initialBackoffMs:
              (typeof config.retryOn429 === "object"
                ? config.retryOn429.initialBackoffMs
                : undefined) ?? 1000,
          }
        : undefined,
      pageSize: DEFAULT_PAGE_SIZE,
    };
  }

  /** The configured export API base URL. */
  get exportApiUrl(): string {
    return this.config.exportApiUrl;
  }

  /** The configured EU Search endpoint. */
  get searchApiUrl(): string {
    return this.config.searchApiUrl;
  }

  /** The configured API key (used by the search transport). */
  get apiKey(): string | undefined {
    return this.config.apiKey;
  }

  /** Default page size applied when a search method does not specify one. */
  get pageSize(): number {
    return this.config.pageSize;
  }

  /** Merged default headers for outgoing requests. */
  get baseHeaders(): Record<string, string> {
    return {
      "user-agent": `@knorby/eu-cosing-client/${VERSION}`,
      ...this.config.headers,
    };
  }

  /** Redacts the configured API key from arbitrary text. */
  redact(text: string): string {
    return redactApiKey(text, this.config.apiKey);
  }

  private sanitizeCause(error: unknown): Error {
    if (error instanceof Error) {
      const copy = new Error(this.redact(error.message));
      copy.name = error.name;
      return copy;
    }
    return new Error(this.redact(String(error)));
  }

  private async sleep(
    ms: number,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    if (ms <= 0) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        const abortError = new Error("aborted");
        abortError.name = "AbortError";
        reject(abortError);
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  /** Single logical request: timeout, cancellation, retry, error mapping. */
  async request(
    url: string,
    init: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
    } = {},
  ): Promise<Response> {
    const maxAttempts = this.config.retry
      ? this.config.retry.maxRetries + 1
      : 1;
    for (let attempt = 1; ; attempt++) {
      const caller = init.signal;
      if (caller?.aborted) {
        throw new CosingNetworkError("Request aborted before it was sent.", {
          url: this.redact(url),
          cause: Object.assign(new Error("aborted"), { name: "AbortError" }),
        });
      }
      const controller = new AbortController();
      const onCallerAbort = () => controller.abort();
      caller?.addEventListener("abort", onCallerAbort, { once: true });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
        const response = await this.fetchFn(url, {
          method: init.method ?? "GET",
          headers: { ...this.baseHeaders, ...init.headers },
          body: init.body,
          signal: controller.signal,
        });
        if (
          response.status === 429 &&
          this.config.retry &&
          attempt < maxAttempts &&
          !(caller?.aborted ?? false)
        ) {
          await response.body?.cancel().catch(() => undefined);
          const retryAfter = parseRetryAfter(
            response.headers.get("retry-after"),
          );
          const backoff = retryAfter
            ? Math.min(retryAfter * 1000, RETRY_DELAY_CAP_MS)
            : Math.min(
                this.config.retry.initialBackoffMs * 2 ** (attempt - 1),
                RETRY_DELAY_CAP_MS,
              );
          await this.sleep(backoff, caller);
          continue;
        }
        return response;
      } catch (error) {
        if (caller?.aborted) {
          throw new CosingNetworkError(
            "Request was cancelled by the caller's AbortSignal.",
            { url: this.redact(url), cause: this.sanitizeCause(error) },
          );
        }
        if (controller.signal.aborted) {
          throw new CosingTimeoutError(
            `Request timed out after ${this.config.timeoutMs}ms: ${this.redact(url)}`,
            { timeoutMs: this.config.timeoutMs },
          );
        }
        throw new CosingNetworkError(
          `Network failure during request: ${this.sanitizeCause(error).message}`,
          { url: this.redact(url), cause: this.sanitizeCause(error) },
        );
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        caller?.removeEventListener("abort", onCallerAbort);
      }
    }
  }

  private async toApiError(
    url: string,
    response: Response,
  ): Promise<CosingApiError> {
    const body = this.redact(await response.text());
    return new CosingApiError(
      `CosIng API responded ${response.status} for ${this.redact(url)}`,
      {
        status: response.status,
        body,
        url: this.redact(url),
        retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
      },
    );
  }

  /** GET returning parsed JSON; empty 2xx bodies resolve to `null`. */
  async getJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.request(url, {
      headers: { accept: "application/json" },
      signal: options.signal,
    });
    if (!response.ok) throw await this.toApiError(url, response);
    const text = await response.text();
    if (text.trim().length === 0) return null as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new CosingParseError(
        `Response was marked JSON but could not be parsed (content-type: ${response.headers.get("content-type") ?? "unknown"}).`,
        { bodySnippet: this.redact(text.slice(0, 200)) },
      );
    }
  }

  /** POST a JSON string body, returning parsed JSON. */
  async postJson<T>(
    url: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await this.request(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      signal: options.signal,
    });
    if (!response.ok) throw await this.toApiError(url, response);
    const text = await response.text();
    if (text.trim().length === 0) return null as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new CosingParseError(
        `Response was marked JSON but could not be parsed (content-type: ${response.headers.get("content-type") ?? "unknown"}).`,
        { bodySnippet: this.redact(text.slice(0, 200)) },
      );
    }
  }

  /** GET returning the raw response body as text (CSV and other exports). */
  async getText(url: string, options: RequestOptions = {}): Promise<string> {
    const response = await this.request(url, {
      headers: { accept: "text/plain, */*" },
      signal: options.signal,
    });
    if (!response.ok) throw await this.toApiError(url, response);
    return response.text();
  }
}
