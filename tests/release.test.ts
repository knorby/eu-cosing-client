import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("release configuration", () => {
  it("keeps the lockfile package identity and runtime requirement in sync", () => {
    const pkg = JSON.parse(read("package.json"));
    const lock = JSON.parse(read("package-lock.json"));
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[""].version).toBe(pkg.version);
    expect(lock.packages[""].engines).toEqual(pkg.engines);
  });

  it("versions packages and refreshes the lockfile together", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["version:packages"]).toBe(
      "changeset version && npm install --package-lock-only --ignore-scripts",
    );
  });

  it("disables releases by default and restricts them to main", () => {
    const workflow = read(".github/workflows/release.yml");
    expect(workflow).toContain("vars.NPM_RELEASE_ENABLED == 'true'");
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("permissions: {}");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).not.toContain("pull_request_target");
  });

  it("checks code and all dependencies before packing without a cache", () => {
    const workflow = read(".github/workflows/release.yml");
    const pack = workflow.split("\n  pack:\n")[1]?.split("\n  publish:\n")[0];
    expect(pack).toBeDefined();
    for (const command of [
      "npm run lint",
      "npm run typecheck",
      "npm test",
      "npm audit --audit-level=moderate",
      "npm run build",
      "npm pack --dry-run",
    ]) {
      expect(pack).toContain(command);
    }
    expect(pack).not.toContain("cache: npm");
    expect(pack).toContain("package-manager-cache: false");
  });

  it("uses the lockfile-aware version script and scopes OIDC to publishing", () => {
    const workflow = read(".github/workflows/release.yml");
    const [beforePublish, publish] = workflow.split("\n  publish:\n");
    expect(beforePublish).toContain("script: npm run version:packages");
    expect(beforePublish).not.toMatch(/^\s+id-token: write/m);
    expect(publish).toContain("id-token: write");
    expect(publish).toContain("environment: release");
    expect(publish).toContain("needs: pack");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
  });

  it("pins every Changesets sub-action to an immutable commit", () => {
    const workflow = read(".github/workflows/release.yml");
    const actions = workflow.match(/uses: changesets\/action\/[^\n]+/g) ?? [];
    expect(actions).toHaveLength(4);
    for (const action of actions) {
      expect(action).toMatch(/@[0-9a-f]{40} # v\d/);
    }
  });
});
