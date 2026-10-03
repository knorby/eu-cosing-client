import type { FetchLike } from "../src/http";

export interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

/**
 * Creates an injectable `fetch` that records every call and serves canned
 * responses from a queue. Real `Response` objects keep the requester
 * exercising production code paths.
 */
export function queuedFetch(
  respond: (
    call: RecordedCall,
    attempt: number,
  ) => Response | Promise<Response>,
): FetchLike & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fn = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return respond(calls[calls.length - 1], calls.length);
  }) as FetchLike & { calls: RecordedCall[] };
  fn.calls = calls;
  return fn;
}

/** A fetch that never resolves and only stops on abort (timeout testing). */
export function hangingFetch(signal: AbortSignal): FetchLike {
  return ((_url, init) => {
    const ctrl = (init as { signal?: AbortSignal }).signal;
    return new Promise<Response>((_resolve, reject) => {
      const onAbort = () => {
        const error = new Error("aborted") as Error & { name: string };
        error.name = ctrl?.aborted
          ? "AbortError"
          : signal.aborted
            ? "AbortError"
            : "Error";
        reject(error);
      };
      if (ctrl?.aborted || signal.aborted) {
        onAbort();
        return;
      }
      ctrl?.addEventListener("abort", onAbort, { once: true });
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }) as FetchLike;
}

/** Minimal realistic search response envelope. */
export function searchResponse(
  totalResults: number,
  results: unknown[],
  pageNumber = 1,
  pageSize = 20,
): unknown {
  return {
    apiVersion: "2.155",
    terms: "",
    responseTime: 12,
    totalResults,
    pageNumber,
    pageSize,
    sort: "relevance",
    queryLanguage: { language: "en", probability: 0 },
    bestBets: [],
    results,
  };
}

/** Minimal realistic search result (all metadata values are arrays). */
export function searchResult(metadata: Record<string, unknown>): unknown {
  return {
    apiVersion: "2.155",
    reference: "d3549992-4b93-41f4-ba3b-358659973fcc",
    url: "urn:test",
    contentType: "text/plain",
    language: "en",
    databaseLabel: "Growth Cosmetic Ingredients and Substances",
    database: "GROWTH_COSING",
    summary: "",
    weight: 18.1,
    content: "",
    accessRestriction: false,
    metadata,
    enrichedMetadata: {},
    children: [],
    highlightedFragments: [],
  };
}

/** Deeply freezes fixture objects so tests cannot mutate shared state. */
export function frozen<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as object)) {
      frozen((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}
