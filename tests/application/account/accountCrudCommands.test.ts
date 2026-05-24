import assert from "node:assert/strict";
import test from "node:test";

import { createId } from "@paralleldrive/cuid2";
import argon2 from "argon2";
import { eq } from "drizzle-orm";

import { executeSoftDeleteAccount } from "../../../src/application/account/commands/softDeleteAccountCommand.js";
import { executeUpdatePassword } from "../../../src/application/account/commands/updatePasswordCommand.js";
import { executeHumanLogin } from "../../../src/application/account/commands/loginCommands.js";
import { executeRefreshToken } from "../../../src/application/account/commands/refreshCommands.js";
import { executeGetAccount } from "../../../src/application/account/queries/getAccountQuery.js";
import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { accounts } from "../../../src/db/schema.runtime.js";
import {
  ACCOUNT_ERROR_CODES,
  AUTH_ERROR_CODES,
  AccountError,
  AuthError,
} from "../../../src/domain/account/errors.js";
import type { AppDeps } from "../../../src/application/deps.js";

const TEST_PASSWORD = "test-password-123";
const NEW_PASSWORD = "new-password-456";

type TestContext = {
  deps: AppDeps;
  handle: DbHandle;
};

async function createTestContext(): Promise<TestContext> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({
    JWT_SECRET: "test-secret-min-16-chars",
    DATABASE_URL: "file::memory:",
  });
  return { deps: { db: handle.db, config }, handle };
}

async function insertAccount(
  deps: AppDeps,
  overrides: Partial<typeof accounts.$inferInsert> = {},
): Promise<{ id: string; email: string }> {
  const id = createId();
  const email = overrides.email ?? `user-${id}@example.com`;
  const passwordHash = overrides.passwordHash ?? (await argon2.hash(TEST_PASSWORD));
  const now = new Date();

  await deps.db.insert(accounts).values({
    id,
    email,
    passwordHash,
    role: "seller",
    status: "active",
    refreshToken: null,
    refreshTokenLookup: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });

  return { id, email };
}

test("executeGetAccount returns public view for owner without secrets", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id, email } = await insertAccount(deps);

    const view = await executeGetAccount(deps, { sub: id, role: "seller" }, id);

    assert.equal(view.id, id);
    assert.equal(view.email, email);
    assert.equal(view.role, "seller");
    assert.equal(view.status, "active");
    assert.ok(view.createdAt instanceof Date);
    assert.ok(view.updatedAt instanceof Date);
    assert.ok(!("passwordHash" in view));
    assert.ok(!("refreshToken" in view));
  } finally {
    await handle.close();
  }
});

test("executeGetAccount allows admin to read any account", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id } = await insertAccount(deps, { role: "risk_analyst" });

    const view = await executeGetAccount(deps, { sub: createId(), role: "admin" }, id);

    assert.equal(view.id, id);
    assert.equal(view.role, "risk_analyst");
  } finally {
    await handle.close();
  }
});

test("executeGetAccount rejects non-admin reading another account", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id: ownerId } = await insertAccount(deps);
    const { id: otherId } = await insertAccount(deps);

    await assert.rejects(
      () => executeGetAccount(deps, { sub: ownerId, role: "seller" }, otherId),
      (e: unknown) => {
        assert.ok(e instanceof AccountError);
        assert.equal(e.code, ACCOUNT_ERROR_CODES.FORBIDDEN);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("executeGetAccount returns not_found for soft-deleted account", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id } = await insertAccount(deps, { deletedAt: new Date() });

    await assert.rejects(
      () => executeGetAccount(deps, { sub: id, role: "seller" }, id),
      (e: unknown) => {
        assert.ok(e instanceof AccountError);
        assert.equal(e.code, ACCOUNT_ERROR_CODES.NOT_FOUND);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("executeUpdatePassword allows login with new password", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id, email } = await insertAccount(deps);

    await executeUpdatePassword(deps, { sub: id, role: "seller" }, id, {
      password: NEW_PASSWORD,
    });

    await assert.rejects(
      () => executeHumanLogin(deps, { email, password: TEST_PASSWORD }),
      (e: unknown) => {
        assert.ok(e instanceof AuthError);
        assert.equal(e.code, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
        return true;
      },
    );

    const login = await executeHumanLogin(deps, { email, password: NEW_PASSWORD });
    assert.ok(login.accessToken.length > 0);
  } finally {
    await handle.close();
  }
});

test("executeUpdatePassword allows admin to update another account password", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id, email } = await insertAccount(deps);

    await executeUpdatePassword(deps, { sub: createId(), role: "admin" }, id, {
      password: NEW_PASSWORD,
    });

    const login = await executeHumanLogin(deps, { email, password: NEW_PASSWORD });
    assert.ok(login.accessToken.length > 0);
  } finally {
    await handle.close();
  }
});

test("executeSoftDeleteAccount soft-deletes account and invalidates refresh token", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id, email } = await insertAccount(deps);
    const login = await executeHumanLogin(deps, { email, password: TEST_PASSWORD });

    await executeSoftDeleteAccount(deps, { role: "admin" }, id);

    const [row] = await deps.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    assert.ok(row?.deletedAt);
    assert.equal(row?.refreshToken, null);
    assert.equal(row?.refreshTokenLookup, null);

    await assert.rejects(
      () => executeGetAccount(deps, { sub: id, role: "seller" }, id),
      (e: unknown) => {
        assert.ok(e instanceof AccountError);
        assert.equal(e.code, ACCOUNT_ERROR_CODES.NOT_FOUND);
        return true;
      },
    );

    await assert.rejects(
      () => executeHumanLogin(deps, { email, password: TEST_PASSWORD }),
      (e: unknown) => {
        assert.ok(e instanceof AuthError);
        assert.equal(e.code, AUTH_ERROR_CODES.ACCOUNT_DELETED);
        return true;
      },
    );

    await assert.rejects(
      () => executeRefreshToken(deps, { refreshToken: login.refreshToken }),
      (e: unknown) => {
        assert.ok(e instanceof AuthError);
        assert.equal(e.code, AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("executeSoftDeleteAccount rejects non-admin", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id: otherId } = await insertAccount(deps);

    await assert.rejects(
      () => executeSoftDeleteAccount(deps, { role: "seller" }, otherId),
      (e: unknown) => {
        assert.ok(e instanceof AccountError);
        assert.equal(e.code, ACCOUNT_ERROR_CODES.FORBIDDEN);
        return true;
      },
    );

    const [row] = await deps.db.select().from(accounts).where(eq(accounts.id, otherId)).limit(1);
    assert.equal(row?.deletedAt, null);
    assert.equal(row?.id, otherId);
  } finally {
    await handle.close();
  }
});
