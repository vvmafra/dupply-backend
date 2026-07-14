import type { AppDeps } from "../../../../compose/deps.js";
import { assertCanAuthenticate } from "../../domain/policies.js";
import { issueRefreshToken } from "../../../../infra/auth/refreshToken.js";
import { findAccountByRefreshToken, persistRefreshToken } from "./accountAuthDb.js";
import { buildLoginResult, type LoginCommandResult } from "./loginCommands.js";

export type RefreshTokenInput = {
  refreshToken: string;
};

export async function executeRefreshToken(
  deps: AppDeps,
  input: RefreshTokenInput,
): Promise<LoginCommandResult> {
  const account = await findAccountByRefreshToken(deps, input.refreshToken);
  assertCanAuthenticate(account);

  const { plain, stored } = await issueRefreshToken();
  await persistRefreshToken(deps, account.id, plain, stored);

  return buildLoginResult(deps, account, plain);
}
