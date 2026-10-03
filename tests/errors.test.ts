import { describe, expect, it } from "vitest";
import {
  cosingDetailUrl,
  DEFAULT_EXPORT_API_URL,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SEARCH_API_URL,
  DEFAULT_TIMEOUT_MS,
  MAX_PAGE_SIZE,
  MAX_SEARCH_PAGES,
} from "../src/constants";
import {
  CosingApiError,
  CosingConfigError,
  CosingError,
  CosingNetworkError,
  CosingParseError,
  CosingTimeoutError,
} from "../src/errors";
import { VERSION } from "../src/version";

describe("errors", () => {
  it("subclasses extend CosingError and pass instanceof checks", () => {
    const cases = [
      new CosingConfigError("no fetch"),
      new CosingTimeoutError("timed out", { timeoutMs: 5000 }),
      new CosingApiError("bad status", {
        status: 429,
        body: "{}",
        url: "https://example.test",
      }),
      new CosingNetworkError("dns failure", { url: "https://example.test" }),
      new CosingParseError("not json", { bodySnippet: "<html>" }),
    ];
    for (const error of cases) {
      expect(error).toBeInstanceOf(CosingError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBeTruthy();
    }
  });

  it("preserves the cause option", () => {
    const cause = new Error("underlying");
    const error = new CosingNetworkError("wrapped", {
      url: "https://example.test",
      cause,
    });
    expect(error.cause).toBe(cause);
  });

  it("carries structured fields on typed errors", () => {
    const api = new CosingApiError("rate limited", {
      status: 429,
      body: "slow down",
      url: "https://example.test/search",
      retryAfterSeconds: 12,
    });
    expect(api.status).toBe(429);
    expect(api.body).toBe("slow down");
    expect(api.url).toBe("https://example.test/search");
    expect(api.retryAfterSeconds).toBe(12);

    const timeout = new CosingTimeoutError("too slow", { timeoutMs: 1234 });
    expect(timeout.timeoutMs).toBe(1234);

    const parse = new CosingParseError("bad body", { bodySnippet: "abc" });
    expect(parse.bodySnippet).toBe("abc");
  });
});

describe("constants", () => {
  it("exposes verified endpoint defaults", () => {
    expect(DEFAULT_SEARCH_API_URL).toBe(
      "https://webgate.ec.europa.eu/es/search-api/rest/search",
    );
    expect(DEFAULT_EXPORT_API_URL).toBe(
      "https://api.tech.ec.europa.eu/cosing20/1.0/api",
    );
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
    expect(MAX_PAGE_SIZE).toBeGreaterThanOrEqual(DEFAULT_PAGE_SIZE);
    expect(MAX_SEARCH_PAGES).toBeGreaterThan(0);
  });

  it("builds stable detail URLs from substance IDs", () => {
    expect(cosingDetailUrl("37479")).toBe(
      "https://ec.europa.eu/growth/tools-databases/cosing/details/37479",
    );
  });
});

describe("version", () => {
  it("falls back to a placeholder when not injected by the bundler", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
