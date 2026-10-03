/**
 * Minimal RFC 7578 multipart/form-data serializer.
 *
 * The EU Search API expects a `multipart/form-data` request whose parts are
 * JSON blobs. Rather than relying on `FormData` (whose `Blob` upload support
 * in React Native is historically unreliable), the search transport builds
 * the body as a plain string — `fetch` accepts string bodies in every
 * runtime this library targets.
 */

export interface MultipartPart {
  /** Form field name. */
  name: string;
  /** Field value; always treated as text. */
  value: string;
  /** Optional per-part `Content-Type` (e.g. `application/json`). */
  contentType?: string;
}

export interface MultipartBody {
  /** The complete multipart body, safe to pass to `fetch` as a string. */
  body: string;
  /** The `Content-Type` header value including the boundary. */
  contentType: string;
}

const BOUNDARY_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Cryptographically-random-enough boundary for form data. */
export function randomBoundary(): string {
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += BOUNDARY_CHARS[Math.floor(Math.random() * BOUNDARY_CHARS.length)];
  }
  return `----cosing${out}`;
}

/**
 * Serializes parts into a multipart/form-data body string. Throws if any
 * part value contains the boundary (a collision would corrupt the body);
 * with a generated boundary this is practically impossible, but the check
 * keeps injected deterministic boundaries honest.
 */
export function buildMultipartBody(
  parts: MultipartPart[],
  boundary: string = randomBoundary(),
): MultipartBody {
  if (parts.some((part) => part.value.includes(boundary))) {
    throw new Error(
      `buildMultipartBody: a part value contains the multipart boundary (${boundary}); use a different boundary.`,
    );
  }
  const sections: string[] = [];
  for (const part of parts) {
    let section = `--${boundary}\r\ncontent-disposition: form-data; name="${part.name}"\r\n`;
    if (part.contentType) {
      section += `content-type: ${part.contentType}\r\n`;
    }
    section += `\r\n${part.value}\r\n`;
    sections.push(section);
  }
  sections.push(`--${boundary}--\r\n`);
  return {
    body: sections.join(""),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
