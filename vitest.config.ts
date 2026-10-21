import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov", "html"],
      include: ["src/**"],
      exclude: ["node_modules/**", "dist/**", "tests/**"],
      thresholds: {
        statements: 100,
        functions: 100,
        lines: 100,
        branches: 95,
      },
    },
  },
});
