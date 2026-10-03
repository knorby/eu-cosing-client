import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CosingClient } from "../src/client";
import type { CosingClientConfig } from "../src/http";
import {
  boundaryOf,
  parseMultipart,
  queuedFetch,
  searchResponse,
  searchResult,
} from "./helpers";

function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
}

function clientWith(
  respond: (
    url: string,
    init: RequestInit | undefined,
    call: { url: string; init?: RequestInit },
  ) => Response,
  config: Partial<CosingClientConfig> = {},
) {
  const fetch = queuedFetch((call) => respond(call.url, call.init, call));
  const client = new CosingClient({ ...config, fetch, apiKey: "sekrit" });
  return { client, fetch };
}

describe("ingredients namespace", () => {
  it("searches by fuzzy text with itemType ingredient", async () => {
    const { client, fetch } = clientWith(() =>
      Response.json(
        searchResponse(25, [
          searchResult({ substanceId: ["37479"], inciName: ["RETINOL"] }),
        ]),
      ),
    );
    const page = await client.ingredients.search({ text: "retinol" });
    expect(page.total).toBe(25);
    expect(page.items[0].item.inciName).toBe("RETINOL");
    expect(page.items[0].matchedOn).toBe("text");
    expect(page.items[0].exact).toBe(false);
    expect(page.hasMore).toBe(true);
    const contentType =
      new Headers(fetch.calls[0].init?.headers).get("content-type") ?? "";
    expect(contentType).toContain("multipart/form-data");
  });

  it("searches by exact INCI name via a term clause", async () => {
    const { client, fetch } = clientWith(() =>
      Response.json(
        searchResponse(1, [searchResult({ inciName: ["RETINOL"] })]),
      ),
    );
    const page = await client.ingredients.search({ inciName: "RETINOL" });
    expect(page.items[0].matchedOn).toBe("inciName");
    expect(page.items[0].exact).toBe(true);
    const contentType =
      new Headers(fetch.calls[0].init?.headers).get("content-type") ?? "";
    const body = String(fetch.calls[0].init?.body);
    expect(body).toContain('"term":{"itemType":"ingredient"}');
    expect(body).toContain('"term":{"inciName":"RETINOL"}');
  });

  it("searches partial CAS via the source's wildcard clause scoped to casNo/ecNo", async () => {
    const { client, fetch } = clientWith(() =>
      Response.json(
        searchResponse(1, [
          searchResult({
            substanceId: ["37479"],
            casNo: ["68-26-8 / 11103-57-4"],
          }),
        ]),
      ),
    );
    const page = await client.ingredients.search({ casNo: "68-26-8" });
    // The server does the matching via the wildcard query (the same
    // mechanism the official app's advanced search uses); no client-side
    // post-filter is involved.
    expect(page.items).toHaveLength(1);
    expect(page.items[0].item.substanceId).toBe("37479");
    expect(page.items[0].matchedOn).toBe("casNo");
    expect(page.items[0].exact).toBe(false);
    const url = new URL(fetch.calls[0].url);
    expect(url.searchParams.get("text")).toBe("");
    const contentType =
      new Headers(fetch.calls[0].init?.headers).get("content-type") ?? "";
    const parts = parseMultipart(
      String(fetch.calls[0].init?.body),
      boundaryOf(contentType),
    );
    const query = JSON.parse(
      parts.find((part) => part.name === "query")?.value ?? "null",
    );
    expect(query).toEqual({
      bool: {
        must: [
          { term: { itemType: "ingredient" } },
          {
            text: { query: "*68\\-26\\-8*", fields: ["casNo", "ecNo"] },
          },
        ],
      },
    });
  });

  it("searches EC numbers through the same wildcard clause", async () => {
    const { client, fetch } = clientWith(() =>
      Response.json(
        searchResponse(1, [
          searchResult({
            substanceId: ["37479"],
            ecNo: ["200-683-7 / 234-328-2"],
          }),
        ]),
      ),
    );
    const page = await client.ingredients.search({ ecNo: "200-683-7" });
    expect(page.items[0].matchedOn).toBe("ecNo");
    expect(page.items[0].exact).toBe(false);
    const contentType =
      new Headers(fetch.calls[0].init?.headers).get("content-type") ?? "";
    const parts = parseMultipart(
      String(fetch.calls[0].init?.body),
      boundaryOf(contentType),
    );
    const query = JSON.parse(
      parts.find((part) => part.name === "query")?.value ?? "null",
    );
    expect(query.bool.must[1]).toEqual({
      text: { query: "*200\\-683\\-7*", fields: ["casNo", "ecNo"] },
    });
  });

  it("gets a single record by stable substance ID", async () => {
    const { client } = clientWith(() =>
      Response.json(
        searchResponse(1, [
          searchResult({ substanceId: ["37479"], inciName: ["RETINOL"] }),
        ]),
      ),
    );
    const match = await client.ingredients.get("37479");
    expect(match?.item.substanceId).toBe("37479");
    expect(match?.matchedOn).toBe("substanceId");
    expect(match?.exact).toBe(true);
    expect(match?.item.source.url).toBe(
      "https://ec.europa.eu/growth/tools-databases/cosing/details/37479",
    );
  });

  it("returns null when a get finds nothing — empty is not an error", async () => {
    const { client } = clientWith(() => Response.json(searchResponse(0, [])));
    expect(await client.ingredients.get("nope")).toBeNull();
  });

  it("rejects invalid paging inputs eagerly", async () => {
    const { client } = clientWith(() => Response.json(searchResponse(0, [])));
    await expect(
      client.ingredients.search({ text: "x", page: 0 }),
    ).rejects.toThrow(RangeError);
    await expect(
      client.ingredients.search({ text: "x", pageSize: 501 }),
    ).rejects.toThrow(RangeError);
  });

  it("searchAll yields across pages and terminates on hasMore=false", async () => {
    const { client } = clientWith((_url, _init, call) => {
      const page = Number(new URL(call.url).searchParams.get("pageNumber"));
      const results =
        page === 1
          ? [
              searchResult({ substanceId: ["1"] }),
              searchResult({ substanceId: ["2"] }),
            ]
          : [searchResult({ substanceId: ["3"] })];
      return Response.json(searchResponse(3, results, page, 2));
    });
    const collected: string[] = [];
    for await (const match of client.ingredients.searchAll(
      { text: "x" },
      { pageSize: 2 },
    )) {
      collected.push(match.item.substanceId);
    }
    expect(collected).toEqual(["1", "2", "3"]);
  });

  it("getFunctions joins the ingredient's function names with vocabulary definitions", async () => {
    const { client } = clientWith((_url, _init, call) => {
      const body = String(call.init?.body);
      if (body.includes('"substanceId"')) {
        return Response.json(
          searchResponse(1, [
            searchResult({
              substanceId: ["37479"],
              inciName: ["RETINOL"],
              functionName: ["SKIN CONDITIONING - MISCELLANEOUS"],
            }),
          ]),
        );
      }
      return Response.json(
        searchResponse(
          2,
          [
            searchResult({
              itemType: ["function"],
              functionId: ["101"],
              functionName: ["SKIN CONDITIONING - MISCELLANEOUS"],
              functionDescription: ["Tending to soften/smooth the skin."],
            }),
            searchResult({
              itemType: ["function"],
              functionId: ["102"],
              functionName: ["ANTIOXIDANT"],
            }),
          ],
          1,
          500,
        ),
      );
    });
    const fns = await client.ingredients.getFunctions("37479");
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe("SKIN CONDITIONING - MISCELLANEOUS");
    expect(fns[0].description).toBe("Tending to soften/smooth the skin.");
    expect(fns[0].functionId).toBe("101");
  });
});

describe("functions namespace", () => {
  it("lists the vocabulary with pagination metadata", async () => {
    const { client } = clientWith(() =>
      Response.json(
        searchResponse(83, [
          searchResult({
            itemType: ["function"],
            functionId: ["101"],
            functionName: ["ADHESIVE"],
          }),
        ]),
      ),
    );
    const page = await client.functions.list();
    expect(page.total).toBe(83);
    expect(page.items[0].item.name).toBe("ADHESIVE");
  });

  it("gets a single function by name", async () => {
    const { client } = clientWith(() =>
      Response.json(
        searchResponse(1, [
          searchResult({
            itemType: ["function"],
            functionId: ["101"],
            functionName: ["ADHESIVE"],
            functionDescription: [
              "Tending to unite/bind/bond surfaces together.",
            ],
          }),
        ]),
      ),
    );
    const match = await client.functions.get("ADHESIVE");
    expect(match?.item.functionId).toBe("101");
    expect(match?.item.description).toContain("unite/bind/bond");
  });

  it("listAll yields every vocabulary entry across pages", async () => {
    const { client } = clientWith((_url, _init, call) => {
      const page = Number(new URL(call.url).searchParams.get("pageNumber"));
      return Response.json(
        searchResponse(
          3,
          [
            searchResult({
              itemType: ["function"],
              functionId: [String(page)],
              functionName: [`F${page}`],
            }),
          ],
          page,
          1,
        ),
      );
    });
    const names: string[] = [];
    for await (const match of client.functions.listAll({ pageSize: 1 })) {
      names.push(match.item.name);
    }
    expect(names).toEqual(["F1", "F2", "F3"]);
  });
});

describe("substances namespace", () => {
  it("searches annex substances with annex and refNo term clauses", async () => {
    const { client, fetch } = clientWith(() =>
      Response.json(
        searchResponse(1, [
          searchResult({ itemType: ["substance"], substanceId: ["104250"] }),
        ]),
      ),
    );
    const page = await client.substances.search({ annex: "III", refNo: "376" });
    expect(page.items[0].matchedOn).toBe("refNo");
    expect(page.items[0].exact).toBe(true);
    const body = String(fetch.calls[0].init?.body);
    expect(body).toContain('"term":{"itemType":"substance"}');
    expect(body).toContain('"term":{"annexNo":"III"}');
    expect(body).toContain('"term":{"refNo":"376"}');
  });
});

describe("annexes namespace", () => {
  it("downloads and parses the annex CSV export", async () => {
    const { client, fetch } = clientWith(
      () => new Response(fixture("annex-iii.csv")),
    );
    const export_ = await client.annexes.get("III");
    expect(export_.kind).toBe("restricted");
    expect(export_.entries).toHaveLength(2);
    expect(export_.entries[0].referenceNumber).toBe("376");
    expect(fetch.calls[0].url).toBe(
      "https://api.tech.ec.europa.eu/cosing20/1.0/api/annexes/III/export-csv",
    );
  });

  it("download returns the raw CSV text", async () => {
    const { client } = clientWith(() => new Response(fixture("annex-ii.csv")));
    const text = await client.annexes.download("II");
    expect(text).toContain("File creation date: 03/10/2026");
  });

  it("rejects unknown annex identifiers", async () => {
    const { client } = clientWith(() => new Response(""));
    // @ts-expect-error runtime misuse
    await expect(client.annexes.get("I")).rejects.toThrow(RangeError);
  });
});

describe("raw namespace", () => {
  it("exposes the raw search escape hatch", async () => {
    const { client, fetch } = clientWith(() =>
      Response.json(searchResponse(0, [])),
    );
    const response = await client.raw.search({
      text: "anything",
      clauses: [{ term: { itemType: "ingredient" } }],
      sort: [{ field: "inciName", order: "asc" }],
    });
    expect(response.totalResults).toBe(0);
    const contentType =
      new Headers(fetch.calls[0].init?.headers).get("content-type") ?? "";
    expect(String(fetch.calls[0].init?.body)).toContain('"sort"');
    expect(contentType).toContain("multipart/form-data");
  });
});
