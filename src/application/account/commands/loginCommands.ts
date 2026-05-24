import argon2 from "argon2";

import type { AppDeps } from "../../deps.js";
import { AUTH_ERROR_CODES, AuthError } from "../../../domain/account/errors.js";
import { assertCanAuthenticate, requireLoginCandidate } from "../../../domain/account/policies.js";
import { mockProfileId } from "../../../domain/account/profileId.js";
import type { AccountAuthSnapshot } from "../../../domain/account/types.js";
import { signAccessToken } from "../../../lib/jwt.js";
import { issueRefreshToken } from "../../../lib/refreshToken.js";
import { findAccountByEmail, persistRefreshToken } from "./accountAuthDb.js";

export type HumanLoginInput = {
  email: string;
  password: string;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
};

export async function buildLoginResult(
  deps: AppDeps,
  account: AccountAuthSnapshot,
  plainRefreshToken: string,
): Promise<LoginResult> {
  const accessToken = await signAccessToken(deps.config, {
    sub: account.id,
    role: account.role,
    profileId: mockProfileId(account.id, account.role),
  });

  return {
    accessToken,
    refreshToken: plainRefreshToken,
    tokenType: "Bearer",
    expiresInSeconds: deps.config.JWT_ACCESS_TTL_SECONDS,
    refreshExpiresInSeconds: deps.config.JWT_REFRESH_TTL_SECONDS,
  };
}

export async function executeHumanLogin(
  deps: AppDeps,
  input: HumanLoginInput,
): Promise<LoginResult> {
  const candidate = requireLoginCandidate(await findAccountByEmail(deps, input.email));
  const ok = await argon2.verify(candidate.passwordHash, input.password);
  if (!ok) {
    throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  }
  assertCanAuthenticate(candidate);

  const { plain, stored } = await issueRefreshToken();
  await persistRefreshToken(deps, candidate.id, plain, stored);

  return buildLoginResult(deps, candidate, plain);
}
