import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
