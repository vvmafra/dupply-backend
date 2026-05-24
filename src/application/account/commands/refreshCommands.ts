import type { AppDeps } from "../../deps.js";
import { assertCanAuthenticate } from "../../../domain/account/policies.js";
import { issueRefreshToken } from "../../../lib/refreshToken.js";
import { findAccountByRefreshToken, persistRefreshToken } from "./accountAuthDb.js";
import { buildLoginResult, type LoginResult } from "./loginCommands.js";

export type RefreshTokenInput = {
  refreshToken: string;
};

export async function executeRefreshToken(
  deps: AppDeps,
  input: RefreshTokenInput,
): Promise<LoginResult> {
  const account = await findAccountByRefreshToken(deps, input.refreshToken);
  assertCanAuthenticate(account);

  const { plain, stored } = await issueRefreshToken();
  await persistRefreshToken(deps, account.id, plain, stored);

  return buildLoginResult(deps, account, plain);
}
