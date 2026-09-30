import { createId } from "@paralleldrive/cuid2";
import argon2 from "argon2";

import type { AppDeps } from "../../src/compose/deps.js";
import { accounts, investors } from "../../src/infra/database/schema.runtime.js";

export const TEST_PASSWORD = "test-password-123";

export async function insertInvestor(
  deps: AppDeps,
  overrides: { email?: string; name?: string } = {},
): Promise<{ accountId: string; investorId: string; email: string }> {
  const accountId = createId();
  const investorId = createId();
  const email = overrides.email ?? `investor-${accountId}@example.com`;
  const name = overrides.name ?? "Test Investor";
  const passwordHash = await argon2.hash(TEST_PASSWORD);
  const now = new Date();

  await deps.db.insert(accounts).values({
    id: accountId,
    email,
    passwordHash,
    role: "investor",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  await deps.db.insert(investors).values({
    id: investorId,
    name,
    accountId,
    balanceCents: 0,
    createdAt: now,
    updatedAt: now,
  });

  return { accountId, investorId, email };
}
