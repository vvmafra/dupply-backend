import assert from "node:assert/strict";
import test from "node:test";

import { createId } from "@paralleldrive/cuid2";

import { executeHumanLogin } from "../../../../src/application/account/commands/loginCommands.js";
import { executeLogout } from "../../../../src/application/account/commands/logoutCommands.js";
import { executeRefreshToken } from "../../../../src/application/account/commands/refreshCommands.js";
import { loadConfig } from "../../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../../src/db/index.js";
import { eq } from "drizzle-orm";
import { accounts } from "../../../../src/db/schema.runtime.js";
import { AUTH_ERROR_CODES, AuthError } from "../../../../src/domain/account/errors.js";
import type { AppDeps } from "../../../../src/application/deps.js";
import { insertAccount, TEST_PASSWORD } from "../../../helpers/sellerTestHelpers.js";

const TEST_PASSWORD_LOCAL = TEST_PASSWORD;

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

test("executeHumanLogin returns tokens and persists refresh state", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id, email } = await insertAccount(deps);

    const result = await executeHumanLogin(deps, { email, password: TEST_PASSWORD_LOCAL });

    assert.equal(result.tokenType, "Bearer");
    assert.ok(result.accessToken.length > 0);
    assert.ok(result.refreshToken.length > 0);
    assert.equal(result.expiresInSeconds, deps.config.JWT_ACCESS_TTL_SECONDS);
    assert.equal(result.refreshExpiresInSeconds, deps.config.JWT_REFRESH_TTL_SECONDS);

    const [row] = await deps.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    assert.ok(row?.refreshToken);
    assert.ok(row?.refreshTokenLookup);
  } finally {
    await handle.close();
  }
});

test("second login overwrites previous refresh token (single session)", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { email } = await insertAccount(deps);

    const first = await executeHumanLogin(deps, { email, password: TEST_PASSWORD_LOCAL });
    const second = await executeHumanLogin(deps, { email, password: TEST_PASSWORD_LOCAL });

    assert.notEqual(first.refreshToken, second.refreshToken);

    await assert.rejects(
      () => executeRefreshToken(deps, { refreshToken: first.refreshToken }),
      (e: unknown) => {
        assert.ok(e instanceof AuthError);
        assert.equal(e.code, AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
        return true;
      },
    );

    const refreshed = await executeRefreshToken(deps, { refreshToken: second.refreshToken });
    assert.ok(refreshed.accessToken.length > 0);
  } finally {
    await handle.close();
  }
});

test("executeRefreshToken rotates token and rejects old refresh token", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { email } = await insertAccount(deps);
    const login = await executeHumanLogin(deps, { email, password: TEST_PASSWORD_LOCAL });

    const refreshed = await executeRefreshToken(deps, { refreshToken: login.refreshToken });
    assert.notEqual(refreshed.refreshToken, login.refreshToken);

    await assert.rejects(
      () => executeRefreshToken(deps, { refreshToken: login.refreshToken }),
      AuthError,
    );
  } finally {
    await handle.close();
  }
});

test("executeLogout nullifies refresh token and blocks subsequent refresh", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id, email } = await insertAccount(deps);
    const login = await executeHumanLogin(deps, { email, password: TEST_PASSWORD_LOCAL });

    await executeLogout(deps, id);

    const [row] = await deps.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    assert.equal(row?.refreshToken, null);
    assert.equal(row?.refreshTokenLookup, null);

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

test("executeHumanLogin rejects inactive account", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { email } = await insertAccount(deps, { status: "inactive" });

    await assert.rejects(
      () => executeHumanLogin(deps, { email, password: TEST_PASSWORD_LOCAL }),
      (e: unknown) => {
        assert.ok(e instanceof AuthError);
        assert.equal(e.code, AUTH_ERROR_CODES.ACCOUNT_INACTIVE);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("executeHumanLogin rejects soft-deleted account", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { email } = await insertAccount(deps, { deletedAt: new Date() });

    await assert.rejects(
      () => executeHumanLogin(deps, { email, password: TEST_PASSWORD_LOCAL }),
      (e: unknown) => {
        assert.ok(e instanceof AuthError);
        assert.equal(e.code, AUTH_ERROR_CODES.ACCOUNT_DELETED);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("executeHumanLogin rejects wrong password", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { email } = await insertAccount(deps);

    await assert.rejects(
      () => executeHumanLogin(deps, { email, password: "wrong-password" }),
      (e: unknown) => {
        assert.ok(e instanceof AuthError);
        assert.equal(e.code, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("executeHumanLogin rejects unknown email", async () => {
  const { deps, handle } = await createTestContext();
  try {
    await assert.rejects(
      () =>
        executeHumanLogin(deps, {
          email: "missing@example.com",
          password: TEST_PASSWORD_LOCAL,
        }),
      (e: unknown) => {
        assert.ok(e instanceof AuthError);
        assert.equal(e.code, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("executeRefreshToken rejects inactive account", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id, email } = await insertAccount(deps);
    const login = await executeHumanLogin(deps, { email, password: TEST_PASSWORD_LOCAL });

    await deps.db
      .update(accounts)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(accounts.id, id));

    await assert.rejects(
      () => executeRefreshToken(deps, { refreshToken: login.refreshToken }),
      (e: unknown) => {
        assert.ok(e instanceof AuthError);
        assert.equal(e.code, AUTH_ERROR_CODES.ACCOUNT_INACTIVE);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
