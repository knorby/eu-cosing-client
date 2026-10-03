import { describe, expect, it } from "vitest";
import { CosingConfigError } from "../src/errors";
import { CosingRequester } from "../src/http";
import { CosingSearchTransport } from "../src/search-transport";
import {
  boundaryOf,
  parseMultipart,
  queuedFetch,
  searchResponse,
  searchResult,
} from "./helpers";

function makeTransport(
  respond: (
    url: string,
    init: RequestInit | undefined,
  ) => Response | Promise<Response>,
  apiKey = "sekrit",
) {
  const fetch = queuedFetch((call) => respond(call.url, call.init));
  const requester = new CosingRequester({ fetch, apiKey });
  const transport = new CosingSearchTransport(requester);
  return { fetch, transport };
}

describe("CosingSearchTransport", () => {
  it("POSTs a multipart query to the EU Search endpoint with key and paging", async () => {
    const { fetch, transport } = makeTransport(() =>
      Response.json(
        searchResponse(1, [searchResult({ substanceId: ["37479"] })]),
      ),
    );
    const response = await transport.search({
      text: "retinol",
      clauses: [{ term: { itemType: "ingredient" } }],
      page: 2,
      pageSize: 50,
    });
    expect(response.totalResults).toBe(1);
    expect(response.results[0].metadata.substanceId).toEqual(["37479"]);

    const call = fetch.calls[0];
    expect(call.url).toBe(
      "https://webgate.ec.europa.eu/es/search-api/rest/search?apiKey=sekrit&text=retinol&pageSize=50&pageNumber=2",
    );
    expect(call.init?.method).toBe("POST");

    const contentType =
      new Headers(call.init?.headers).get("content-type") ?? "";
    expect(contentType).toContain("multipart/form-data");
    const parts = parseMultipart(
      String(call.init?.body),
      boundaryOf(contentType),
    );
    const query = parts.find((part) => part.name === "query");
    expect(query?.contentType).toBe("application/json");
    expect(JSON.parse(query?.value ?? "{}")).toEqual({
      bool: { must: [{ term: { itemType: "ingredient" } }] },
    });
    expect(parts.find((part) => part.name === "sort")).toBeUndefined();
  });

  it("encodes special characters in the text parameter", async () => {
    const { fetch, transport } = makeTransport(() =>
      Response.json(searchResponse(0, [])),
    );
    await transport.search({ text: "vitamin a & b", clauses: [] });
    expect(fetch.calls[0].url).toContain("text=vitamin%20a%20%26%20b");
  });

  it("includes a sort part when sort clauses are given", async () => {
    const { fetch, transport } = makeTransport(() =>
      Response.json(searchResponse(0, [])),
    );
    await transport.search({
      clauses: [],
      sort: [{ field: "inciName", order: "asc" }],
    });
    const contentType =
      new Headers(fetch.calls[0].init?.headers).get("content-type") ?? "";
    const parts = parseMultipart(
      String(fetch.calls[0].init?.body),
      boundaryOf(contentType),
    );
    const sort = parts.find((part) => part.name === "sort");
    expect(JSON.parse(sort?.value ?? "null")).toEqual([
      { field: "inciName", order: "asc" },
    ]);
  });

  it("throws CosingConfigError when no API key is configured", async () => {
    const fetch = queuedFetch(() => Response.json(searchResponse(0, [])));
    const requester = new CosingRequester({ fetch });
    const transport = new CosingSearchTransport(requester);
    await expect(transport.search({ clauses: [] })).rejects.toThrow(
      CosingConfigError,
    );
  });
});
