/**
 * Error taxonomy for `@knorby/eu-cosing-client`.
 *
 * Every error thrown by this library extends {@link CosingError}, so
 * `instanceof CosingError` distinguishes client-originated failures from
 * consumer bugs. Empty results are **not** errors — they are empty arrays.
 */

export interface CosingErrorOptions {
  cause?: unknown;
}

/**
 * Base class for all errors thrown by this client. Carries an optional
 * `cause` (the underlying transport error, if any).
 */
export class CosingError extends Error {
  constructor(message: string, options: CosingErrorOptions = {}) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    // Restore prototype chain: TS's `super(...)` with ES targets can leave
    // `this` with Error.prototype when subclasses are down-compiled.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
  }
}

/** Thrown when the client is misconfigured (missing `fetch` or API key). */
export class CosingConfigError extends CosingError {}

/** Thrown when a request exceeds its configured timeout. */
export class CosingTimeoutError extends CosingError {
  /** The per-attempt timeout that was exceeded, in milliseconds. */
  readonly timeoutMs: number;

  constructor(
    message: string,
    options: CosingErrorOptions & { timeoutMs: number },
  ) {
    super(message, options);
    this.timeoutMs = options.timeoutMs;
  }
}

export interface CosingApiErrorOptions extends CosingErrorOptions {
  status: number;
  /** Raw response body (API key redacted). */
  body: string;
  /** Request URL (API key redacted). */
  url: string;
  /** Parsed `Retry-After` header in seconds, when present. */
  retryAfterSeconds?: number;
}

/** Thrown for non-2xx HTTP responses from either CosIng transport. */
export class CosingApiError extends CosingError {
  readonly status: number;
  readonly body: string;
  readonly url: string;
  readonly retryAfterSeconds: number | undefined;

  constructor(message: string, options: CosingApiErrorOptions) {
    super(message, options);
    this.status = options.status;
    this.body = options.body;
    this.url = options.url;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface CosingNetworkErrorOptions extends CosingErrorOptions {
  /** Request URL (API key redacted). */
  url: string;
}

/** Thrown for transport-level failures (DNS, connection reset, aborted). */
export class CosingNetworkError extends CosingError {
  readonly url: string;

  constructor(message: string, options: CosingNetworkErrorOptions) {
    super(message, options);
    this.url = options.url;
  }
}

export interface CosingParseErrorOptions extends CosingErrorOptions {
  /** Prefix of the body that could not be parsed (redacted). */
  bodySnippet: string;
}

/**
 * Thrown when a successful HTTP response has an unparseable body
 * (non-JSON where JSON was required, malformed CSV). Keeps "invalid
 * response content" distinguishable from transport failures.
 */
export class CosingParseError extends CosingError {
  readonly bodySnippet: string;

  constructor(message: string, options: CosingParseErrorOptions) {
    super(message, options);
    this.bodySnippet = options.bodySnippet;
  }
}
