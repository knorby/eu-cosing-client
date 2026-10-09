import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as cosing from "../src/index";

/**
 * SH-01 guard: the core runtime must stay usable in React Native, where
 * Node builtins do not exist. Scans every source file under `src/` for
 * imports of `node:*` builtins or classic Node globals. Test files and
 * build tooling (tsup.config.ts) are exempt — only the shipped runtime is
 * constrained.
 */
function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("universal runtime guard", () => {
  it("src/ contains no Node builtin imports", () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(
      join(import.meta.dirname, "..", "src"),
    )) {
      const text = readFileSync(file, "utf8");
      if (/from\s+["']node:/u.test(text) || /require\(["']node:/u.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("export surface", () => {
  it("exposes the public API", () => {
    expect(typeof cosing.CosingClient).toBe("function");
    expect(typeof cosing.CosingError).toBe("function");
    expect(typeof cosing.parseAnnexCsv).toBe("function");
    expect(typeof cosing.buildMultipartBody).toBe("function");
    expect(typeof cosing.splitIdentifiers).toBe("function");
    expect(typeof cosing.toIngredient).toBe("function");
    expect(cosing.DEFAULT_SEARCH_API_URL).toContain("webgate.ec.europa.eu");
    expect(cosing.DEFAULT_EXPORT_API_URL).toContain("api.tech.ec.europa.eu");
  });

  it("namespaces exist on client instances", () => {
    const client = new cosing.CosingClient({
      fetch: (() => Promise.resolve(new Response("{}"))) as typeof fetch,
      apiKey: "sekrit",
    });
    for (const namespace of [
      "ingredients",
      "functions",
      "substances",
      "annexes",
      "raw",
    ] as const) {
      expect(client[namespace]).toBeTruthy();
    }
  });
});
