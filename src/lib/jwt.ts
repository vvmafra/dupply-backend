import * as jose from "jose";

import type { AppConfig } from "../config.js";
import type { AccountRole } from "../domain/account/types.js";

export type AccessTokenPayload = {
  sub: string;
  role: AccountRole;
  profileId: string;
};

function secretKey(config: AppConfig): Uint8Array {
  return new TextEncoder().encode(config.JWT_SECRET);
}

export async function signAccessToken(
  config: AppConfig,
  payload: AccessTokenPayload,
): Promise<string> {
  const secret = secretKey(config);
  return new jose.SignJWT({
    role: payload.role,
    profileId: payload.profileId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(config.JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${config.JWT_ACCESS_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(
  config: AppConfig,
  token: string,
): Promise<AccessTokenPayload> {
  const secret = secretKey(config);
  const { payload } = await jose.jwtVerify(token, secret, {
    issuer: config.JWT_ISSUER,
    algorithms: ["HS256"],
  });
  const sub = payload.sub;
  const role = payload.role;
  const profileId = payload.profileId;
  if (typeof sub !== "string" || typeof role !== "string" || typeof profileId !== "string") {
    throw new Error("invalid_token_claims");
  }
  return { sub, role: role as AccountRole, profileId };
}
