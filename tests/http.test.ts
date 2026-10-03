import { describe, expect, it } from "vitest";
import {
  CosingConfigError,
  CosingError,
  CosingNetworkError,
  CosingParseError,
} from "../src/errors";
import { CosingRequester, redactApiKey } from "../src/http";
import { hangingFetch, queuedFetch } from "./helpers";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("redactApiKey", () => {
  it("removes the key value from URLs", () => {
    const url = "https://example.test/search?apiKey=sekrit&text=retinol";
    expect(redactApiKey(url, "sekrit")).toBe(
      "https://example.test/search?apiKey=***&text=retinol",
    );
  });

  it("removes URL-encoded forms too", () => {
    expect(redactApiKey("x?key=sek%72it&y=1", "sekrit")).toBe("x?key=***&y=1");
  });

  it("leaves strings without the key untouched", () => {
    expect(
      redactApiKey("https://example.test/annexes/II/export-csv", "sekrit"),
    ).toBe("https://example.test/annexes/II/export-csv");
  });
});

describe("CosingRequester", () => {
  it("throws CosingConfigError when no fetch exists anywhere", () => {
    const saved = globalThis.fetch;
    // biome-ignore lint/suspicious/noExplicitAny: test mutates the global
    (globalThis as any).fetch = undefined;
    try {
      expect(() => new CosingRequester({})).toThrow(CosingConfigError);
    } finally {
      // biome-ignore lint/suspicious/noExplicitAny: test mutates the global
      (globalThis as any).fetch = saved;
    }
  });

  it("GETs JSON with default headers and returns the parsed body", async () => {
    const fetch = queuedFetch(() => json({ ok: true }));
    const requester = new CosingRequester({ fetch });
    const body = await requester.getJson<{ ok: boolean }>(
      "https://example.test/x",
    );
    expect(body).toEqual({ ok: true });
    const call = fetch.calls[0];
    expect(call.url).toBe("https://example.test/x");
    expect(new Headers(call.init?.headers).get("accept")).toBe(
      "application/json",
    );
    expect(new Headers(call.init?.headers).get("user-agent")).toMatch(
      /^@knorby\/eu-cosing-client\//,
    );
  });

  it("resolves null for an empty 2xx body", async () => {
    const fetch = queuedFetch(() => new Response("", { status: 200 }));
    const requester = new CosingRequester({ fetch });
    expect(await requester.getJson("https://example.test/x")).toBeNull();
  });

  it("throws CosingParseError for a 2xx non-JSON body", async () => {
    const fetch = queuedFetch(
      () =>
        new Response("<html>not json</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    );
    const requester = new CosingRequester({ fetch });
    const error = await requester
      .getJson("https://example.test/x")
      .catch((e) => e);
    expect(error).toBeInstanceOf(CosingParseError);
    expect(error.bodySnippet).toContain("not json");
  });

  it("maps non-2xx responses to CosingApiError with status, body and redacted URL", async () => {
    const fetch = queuedFetch(
      () =>
        new Response("nope", {
          status: 404,
          headers: { "content-type": "text/plain" },
        }),
    );
    const requester = new CosingRequester({ fetch, apiKey: "sekrit" });
    const error = await requester
      .getJson("https://example.test/search?apiKey=sekrit&text=x")
      .catch((e) => e);
    expect(error).toBeInstanceOf(CosingError);
    expect(error.status).toBe(404);
    expect(error.body).toBe("nope");
    expect(error.url).not.toContain("sekrit");
    expect(error.url).toContain("apiKey=***");
  });

  it("parses numeric and HTTP-date Retry-After headers", async () => {
    const fetch = queuedFetch(
      () => new Response("", { status: 429, headers: {} }),
    );
    const requester = new CosingRequester({ fetch });
    const error = await requester
      .getJson("https://example.test/x")
      .catch((e) => e);
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBeUndefined();

    const fetch2 = queuedFetch(
      () =>
        new Response("", {
          status: 429,
          headers: { "retry-after": "12" },
        }),
    );
    const requester2 = new CosingRequester({ fetch: fetch2 });
    const error2 = await requester2
      .getJson("https://example.test/x")
      .catch((e) => e);
    expect(error2.retryAfterSeconds).toBe(12);

    const future = new Date(Date.now() + 30_000).toUTCString();
    const fetch3 = queuedFetch(
      () =>
        new Response("", { status: 429, headers: { "retry-after": future } }),
    );
    const requester3 = new CosingRequester({ fetch: fetch3 });
    const error3 = await requester3
      .getJson("https://example.test/x")
      .catch((e) => e);
    expect(error3.retryAfterSeconds).toBeGreaterThan(20);
    expect(error3.retryAfterSeconds).toBeLessThanOrEqual(31);
  });

  it("maps transport failures to CosingNetworkError with a copied, redacted cause", async () => {
    const original = new TypeError("fetch failed near apiKey=sekrit");
    const fetch = queuedFetch(() => {
      throw original;
    });
    const requester = new CosingRequester({ fetch, apiKey: "sekrit" });
    const error = await requester
      .getJson("https://example.test/x")
      .catch((e) => e);
    expect(error).toBeInstanceOf(CosingNetworkError);
    expect(error.cause).not.toBe(original);
    expect((error.cause as Error).name).toBe("TypeError");
    expect((error.cause as Error).message).not.toContain("sekrit");
    expect(original.message).toContain("sekrit");
  });

  it("throws CosingTimeoutError when the attempt exceeds timeoutMs", async () => {
    let inner: AbortSignal | undefined;
    const fetch = queuedFetch((_call, _attempt) => {
      // Hang, but resolve when the request's own signal aborts.
      return new Promise<Response>((_resolve, reject) => {
        inner = (fetch.calls[0].init as { signal?: AbortSignal }).signal;
        inner?.addEventListener("abort", () => {
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });
    const requester = new CosingRequester({ fetch, timeoutMs: 40 });
    const error = await requester
      .getJson("https://example.test/x")
      .catch((e) => e);
    expect(error).toBeInstanceOf(CosingError);
    expect(error.timeoutMs).toBe(40);
    expect(error.name).toContain("Timeout");
  });

  it("retries 429s when retryOn429 is enabled, honoring Retry-After", async () => {
    const fetch = queuedFetch((_call, attempt) =>
      attempt === 1
        ? new Response("", { status: 429, headers: { "retry-after": "0" } })
        : json({ ok: true }),
    );
    const requester = new CosingRequester({ fetch, retryOn429: true });
    const body = await requester.getJson("https://example.test/x");
    expect(body).toEqual({ ok: true });
    expect(fetch.calls).toHaveLength(2);
  });

  it("does not retry 429s by default", async () => {
    const fetch = queuedFetch(() => new Response("", { status: 429 }));
    const requester = new CosingRequester({ fetch });
    const error = await requester
      .getJson("https://example.test/x")
      .catch((e) => e);
    expect(error.status).toBe(429);
    expect(fetch.calls).toHaveLength(1);
  });

  it("supports caller cancellation via an AbortSignal", async () => {
    const caller = new AbortController();
    const fetch = hangingFetch(caller.signal);
    const requester = new CosingRequester({ fetch });
    const pending = requester.getJson("https://example.test/x", {
      signal: caller.signal,
    });
    setTimeout(() => caller.abort(), 10);
    const error = await pending.catch((e) => e);
    expect(error).toBeInstanceOf(CosingNetworkError);
    expect((error.cause as Error).name).toBe("AbortError");
  });
});
