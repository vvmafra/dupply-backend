import { createHmac, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serialize = require("canonicalize") as (input: unknown) => string | undefined;

/**
 * Etherfuse webhook verification (RFC 8785 JCS via `canonicalize` package).
 * @see https://docs.etherfuse.com/guides/verifying-webhooks
 */
export function verifyEtherfuseWebhookSignature(
  body: Record<string, unknown>,
  secretBase64: string,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;
  const canonicalized = serialize(body);
  if (canonicalized === undefined) return false;
  const key = Buffer.from(secretBase64, "base64");
  const hmac = createHmac("sha256", key).update(canonicalized).digest("hex");
  const expected = `sha256=${hmac}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
