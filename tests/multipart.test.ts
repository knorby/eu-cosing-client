import { describe, expect, it } from "vitest";
import {
  buildMultipartBody,
  type MultipartPart,
  randomBoundary,
} from "../src/multipart";

function parseParts(body: string, boundary: string): MultipartPart[] {
  const delimiter = `--${boundary}`;
  const chunks = body.split(delimiter).slice(1, -1);
  return chunks.map((chunk) => {
    const separator = "\r\n\r\n";
    const headerEnd = chunk.indexOf(separator);
    const headers = chunk.slice(0, headerEnd);
    const value = chunk
      .slice(headerEnd + separator.length)
      .replace(/\r\n$/u, "");
    const name = /name="([^"]+)"/u.exec(headers)?.[1];
    const contentType = /content-type:\s*([^\r\n]+)/iu.exec(headers)?.[1];
    if (!name) throw new Error("missing name in test parser");
    return { name, value, contentType };
  });
}

describe("buildMultipartBody", () => {
  it("builds a spec-shaped multipart body with boundary round-trip", () => {
    const parts: MultipartPart[] = [
      {
        name: "query",
        value: '{"bool":{"must":[]}}',
        contentType: "application/json",
      },
      { name: "sort", value: '[{"field":"inciName"}]' },
    ];
    const { body, contentType } = buildMultipartBody(parts, "testboundary");
    expect(contentType).toBe("multipart/form-data; boundary=testboundary");
    expect(body.startsWith("--testboundary\r\n")).toBe(true);
    expect(body.endsWith("--testboundary--\r\n")).toBe(true);
    const parsed = parseParts(body, "testboundary");
    expect(parsed[0]).toEqual({
      name: "query",
      value: '{"bool":{"must":[]}}',
      contentType: "application/json",
    });
    expect(parsed[1]).toEqual({
      name: "sort",
      value: '[{"field":"inciName"}]',
      contentType: undefined,
    });
  });

  it("escapes nothing that needs escaping and handles unicode values", () => {
    const { body, contentType } = buildMultipartBody(
      [{ name: "text", value: "héllo — “quotes” & newlines\nkept" }],
      "testboundary",
    );
    expect(contentType).toContain("multipart/form-data");
    expect(body).toContain("héllo — “quotes” & newlines\nkept");
  });

  it("throws when a part value would collide with the boundary", () => {
    expect(() =>
      buildMultipartBody(
        [{ name: "evil", value: "x--testboundary--y" }],
        "testboundary",
      ),
    ).toThrow(/boundary/i);
  });

  it("generates distinct boundaries", () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomBoundary()));
    expect(seen.size).toBe(50);
  });
});
