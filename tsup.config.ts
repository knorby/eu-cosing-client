import { defineConfig } from "tsup";

// Declaration files are emitted by `tsc --emitDeclarationOnly` (see the
// "build" script in package.json), NOT by tsup's `dts: true`. tsup's dts
// generation is incompatible with TypeScript 7: it emits extensionless
// relative imports in .d.ts output, which breaks Node16-style resolution
// ("relative import paths need explicit file extensions"). Keep the split
// build unless that upstream issue is resolved.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "es2022",
});
