/**
 * Dev-only seed: platform users (seller, payer, risk, admin, service agent).
 * Run: `set -a && source .env && set +a && npm run seed:platform:dev`
 * (requires DATABASE_URL; uses same DB as the API).
 *
 * Default password for all human accounts: `dev-password-change-me`
 * Service agent API key is printed once to stdout.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import argon2 from "argon2";

import { loadConfig } from "../src/config.js";
import { createDb } from "../src/db/index.js";
import { platformUsers } from "../src/db/schema.runtime.js";

const DEV_PASSWORD = "dev-password-change-me";

async function main(): Promise<void> {
  const config = loadConfig();
  const dbHandle = createDb(config.DATABASE_URL);
  const { db } = dbHandle;
  const passwordHash = await argon2.hash(DEV_PASSWORD);

  const humans: {
    email: string;
    role: string;
  }[] = [
    { email: "seller@dupply.dev.local", role: "seller" },
    { email: "payer@dupply.dev.local", role: "payer" },
    { email: "risk@dupply.dev.local", role: "risk_analyst" },
    { email: "admin@dupply.dev.local", role: "admin" },
  ];

  const now = String(Date.now());

  for (const h of humans) {
    const [existing] = await db.select().from(platformUsers).where(eq(platformUsers.email, h.email)).limit(1);
    if (existing) {
      console.log(`skip (exists): ${h.email}`);
      continue;
    }
    await db.insert(platformUsers).values({
      id: randomUUID(),
      email: h.email,
      passwordHash,
      principalKind: "human",
      role: h.role,
      status: "active",
      serviceApiKeyHash: null,
      createdAtMs: now,
      updatedAtMs: now,
    });
    console.log(`created: ${h.email} role=${h.role}`);
  }

  const agentEmail = "agent@dupply.service.local";
  const [agentExisting] = await db.select().from(platformUsers).where(eq(platformUsers.email, agentEmail)).limit(1);
  if (!agentExisting) {
    const apiKeyPlain = `dupply_svc_${randomBytes(24).toString("hex")}`;
    const serviceApiKeyHash = await argon2.hash(apiKeyPlain);
    await db.insert(platformUsers).values({
      id: randomUUID(),
      email: agentEmail,
      passwordHash: null,
      principalKind: "service",
      role: "risk_analyst_agent",
      status: "active",
      serviceApiKeyHash,
      createdAtMs: now,
      updatedAtMs: now,
    });
    console.log(`created service: ${agentEmail}`);
    console.log(`\n>>> SERVICE API KEY (save now; not stored in plain):\n${apiKeyPlain}\n`);
  } else {
    console.log(`skip (exists): ${agentEmail}`);
  }

  await dbHandle.close();
  console.log("\nHuman login: POST /v1/auth/login with email + password above.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
