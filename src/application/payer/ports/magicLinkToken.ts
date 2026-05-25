import type { AppDeps } from "../../deps.js";
import { PAYER_ERROR_CODES, PayerError } from "../../../domain/payer/errors.js";

export type MagicLinkTokenPayload = { receivableId: string; payerId: string };

/** Stub until Module 4 implements payer_magic_tokens storage. */
export async function consumePayerMagicToken(
  _deps: AppDeps,
  token: string,
): Promise<MagicLinkTokenPayload> {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as unknown;
    if (
      decoded !== null &&
      typeof decoded === "object" &&
      "receivableId" in decoded &&
      "payerId" in decoded &&
      typeof (decoded as MagicLinkTokenPayload).receivableId === "string" &&
      typeof (decoded as MagicLinkTokenPayload).payerId === "string"
    ) {
      return decoded as MagicLinkTokenPayload;
    }
  } catch {
    // fall through
  }
  throw new PayerError(PAYER_ERROR_CODES.INVALID_TOKEN);
}

export function encodeStubMagicLinkToken(payload: MagicLinkTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}
