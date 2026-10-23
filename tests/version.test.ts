import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `PKG_VERSION` is a build-time `define` injected by tsup. Under Vitest it is
 * an ordinary global lookup, so the placeholder and injected paths can both
 * be exercised by staging the global and re-importing the module.
 */
const globals = globalThis as typeof globalThis & {
  PKG_VERSION?: string;
};

afterEach(() => {
  delete globals.PKG_VERSION;
  vi.resetModules();
});

describe("VERSION", () => {
  it("falls back to the placeholder when no build version is injected", async () => {
    vi.resetModules();
    const { VERSION } = await import("../src/version");
    expect(VERSION).toBe("0.0.0");
  });

  it("uses the injected package version", async () => {
    globals.PKG_VERSION = "9.9.9";
    vi.resetModules();
    const { VERSION } = await import("../src/version");
    expect(VERSION).toBe("9.9.9");
  });

  it("ignores an empty injected version", async () => {
    globals.PKG_VERSION = "";
    vi.resetModules();
    const { VERSION } = await import("../src/version");
    expect(VERSION).toBe("0.0.0");
  });
});
