#!/usr/bin/env node
/**
 * Compares the built-in public EU Search key (src/constants.ts) against the
 * CosIng web app's live public configuration.
 *
 * Maintainer tooling — never published (the `files` whitelist in
 * package.json ships only dist/, README.md, CHANGELOG.md, and LICENSE).
 * One unauthenticated GET of a static JSON asset the web app serves to
 * every browser; honest User-Agent. Runs manually and in the daily
 * scheduled live-smoke workflow (.github/workflows/live-smoke.yml).
 *
 * Exit codes: 0 = up to date, 1 = drift (prints values to paste), 2 = could
 * not verify automatically (prints the manual DevTools fallback).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_URL =
  "https://ec.europa.eu/growth/tools-databases/cosing/assets/env-json-config.json";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function extractConstant(source, name) {
  const match = source.match(
    new RegExp(`export const ${name}\\s*=\\s*"([^"]+)"`, "u"),
  );
  return match?.[1];
}

function manualFallback() {
  console.error(
    "Manual check: open the CosIng web app, DevTools → Network → filter\n" +
      "`env-json-config.json`, and compare its `euSearchApiKey` against\n" +
      `DEFAULT_SEARCH_API_KEY in src/constants.ts. Config URL: ${CONFIG_URL}`,
  );
}

async function main() {
  const constantsPath = join(repoRoot, "src", "constants.ts");
  let shippedKey;
  let shippedUrl;
  try {
    const source = readFileSync(constantsPath, "utf8");
    shippedKey = extractConstant(source, "DEFAULT_SEARCH_API_KEY");
    shippedUrl = extractConstant(source, "DEFAULT_SEARCH_API_URL");
  } catch {
    console.error(`could not read or parse ${constantsPath}`);
    process.exit(2);
  }
  if (!shippedKey || !shippedUrl) {
    console.error(
      "could not extract DEFAULT_SEARCH_API_KEY / DEFAULT_SEARCH_API_URL —\n" +
        "are they still plain double-quoted string constants?",
    );
    process.exit(2);
  }

  let version = "dev";
  try {
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    );
    version = pkg.version ?? version;
  } catch {
    // User-Agent falls back to "dev" — not worth failing over.
  }

  const config = await fetchConfig(version);
  if (!config) {
    manualFallback();
    process.exit(2);
  }

  const drift = [];
  if (config.euSearchApiKey !== shippedKey) {
    drift.push(
      `DEFAULT_SEARCH_API_KEY\n  shipped: ${shippedKey}\n  live:     ${config.euSearchApiKey}`,
    );
  }
  if (config.euSearchApiUrl !== shippedUrl) {
    drift.push(
      `DEFAULT_SEARCH_API_URL\n  shipped: ${shippedUrl}\n  live:     ${config.euSearchApiUrl}`,
    );
  }

  if (drift.length === 0) {
    console.log(`up to date — key ${shippedKey}, endpoint ${shippedUrl}`);
    return;
  }
  console.error(
    "drift detected between src/constants.ts and the live web app config:\n\n" +
      `${drift.join("\n\n")}\n\n` +
      "Update the constants in src/constants.ts (and its verification-date\n" +
      "comment), then commit with a changeset if published behavior changed.",
  );
  process.exit(1);
}

async function fetchConfig(version) {
  try {
    const response = await fetch(CONFIG_URL, {
      headers: {
        "user-agent": `@knorby/eu-cosing-client/${version} key-check`,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.error(`config URL responded HTTP ${response.status}`);
      return null;
    }
    const json = await response.json();
    if (
      typeof json?.euSearchApiKey !== "string" ||
      typeof json?.euSearchApiUrl !== "string"
    ) {
      console.error("config JSON lacks string euSearchApiKey/euSearchApiUrl");
      return null;
    }
    return json;
  } catch (error) {
    console.error(`fetching the config failed: ${String(error)}`);
    return null;
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(2);
});
