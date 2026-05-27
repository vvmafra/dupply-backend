import { createId } from "@paralleldrive/cuid2";
import argon2 from "argon2";

import type { AppDeps } from "../../deps.js";
import { accounts, sellers } from "../../../db/schema.runtime.js";
import { runTransaction } from "../../../db/transaction.js";
import {
  EMPTY_BUSINESS_RELATIONS_METADATA,
  EMPTY_COMPANY_METADATA,
  EMPTY_LEGAL_REP_METADATA,
} from "../../../domain/seller/types.js";

export type RegisterSellerInput = {
  email: string;
  password: string;
  name: string;
};

export async function executeRegisterSeller(
  deps: AppDeps,
  input: RegisterSellerInput,
): Promise<{ accountId: string; sellerId: string }> {
  const accountId = createId();
  const sellerId = createId();
  const passwordHash = await argon2.hash(input.password);

  await runTransaction(deps.db, deps.config.DATABASE_URL, (tx, exec) => {
    exec(
      tx.insert(accounts).values({
        id: accountId,
        email: input.email,
        passwordHash,
        role: "seller",
        status: "active",
      }),
    );
    exec(
      tx.insert(sellers).values({
        id: sellerId,
        name: input.name,
        status: "created",
        accountId,
        companyMetaData: EMPTY_COMPANY_METADATA,
        legalRepresentativeMetaData: EMPTY_LEGAL_REP_METADATA,
        businessRelationsMetaData: EMPTY_BUSINESS_RELATIONS_METADATA,
        walletId: null,
      }),
    );
  });

  return { accountId, sellerId };
}
