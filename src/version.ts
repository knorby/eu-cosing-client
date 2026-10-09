/**
 * Package version. `PKG_VERSION` is injected at build time by tsup
 * (`define`); when running from source (e.g. under Vitest) it is undefined
 * and the placeholder is used instead.
 */
declare const PKG_VERSION: string | undefined;

export const VERSION: string =
  typeof PKG_VERSION === "string" && PKG_VERSION.length > 0
    ? PKG_VERSION
    : "0.0.0";
