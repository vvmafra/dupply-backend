import argon2 from "argon2";

import type { AppDeps } from "../../deps.js";
import { AUTH_ERROR_CODES, AuthError } from "../../../domain/account/errors.js";
import { assertCanAuthenticate, requireLoginCandidate } from "../../../domain/account/policies.js";
import type { AccountAuthSnapshot } from "../../../domain/account/types.js";
import { resolveProfileId } from "../../../domain/account/profileId.js";
import { signAccessToken } from "../../../lib/jwt.js";
import { issueRefreshToken } from "../../../lib/refreshToken.js";
import { findAccountByEmail, persistRefreshToken } from "./accountAuthDb.js";

export type HumanLoginInput = {
  email: string;
  password: string;
};

export type LoginResponseBody = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
};

export type LoginCommandResult = {
  body: LoginResponseBody;
  refreshToken: string;
};

export async function buildLoginResult(
  deps: AppDeps,
  account: AccountAuthSnapshot,
  plainRefreshToken: string,
): Promise<LoginCommandResult> {
  const profileId = await resolveProfileId(deps, account.id, account.role);
  const accessToken = await signAccessToken(deps.config, {
    sub: account.id,
    role: account.role,
    profileId,
  });

  return {
    body: {
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds: deps.config.JWT_ACCESS_TTL_SECONDS,
    },
    refreshToken: plainRefreshToken,
  };
}

export async function executeHumanLogin(
  deps: AppDeps,
  input: HumanLoginInput,
): Promise<LoginCommandResult> {
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
