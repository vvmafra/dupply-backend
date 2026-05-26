import assert from "node:assert/strict";
import test from "node:test";

import cookie from "@fastify/cookie";
import Fastify from "fastify";
import type { FastifyReply } from "fastify";

import type { AppConfig } from "../../src/config.js";
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  clearRefreshCookie,
  setRefreshCookie,
} from "../../src/lib/authCookie.js";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: "development",
    PORT: 8080,
    HOST: "0.0.0.0",
    DATABASE_URL: "file:./data/dupply.db",
    ETHERFUSE_BASE_URL: "https://api.sand.etherfuse.com",
    STELLAR_NETWORK: "testnet",
    SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 604_800,
    JWT_ISSUER: "dupply-backend",
    ...overrides,
  };
}

function setCookieHeader(res: { headers: { "set-cookie"?: string | string[] } }): string {
  const raw = res.headers["set-cookie"];
  if (Array.isArray(raw)) {
    return raw.join("; ");
  }
  return raw ?? "";
}

async function injectCookieHandler(
  config: AppConfig,
  handler: (reply: FastifyReply) => void,
) {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  app.get("/test", async (_request, reply) => {
    handler(reply);
    return reply.send({ ok: true });
  });
  await app.ready();

  const res = await app.inject({ method: "GET", url: "/test" });
  await app.close();
  return res;
}

test("REFRESH_COOKIE_NAME and REFRESH_COOKIE_PATH constants", () => {
  assert.equal(REFRESH_COOKIE_NAME, "dupply_rt");
  assert.equal(REFRESH_COOKIE_PATH, "/v1/auth");
});

test("setRefreshCookie in production sets Secure, HttpOnly, SameSite, Path, and Max-Age", async () => {
  const config = makeConfig({
    NODE_ENV: "production",
    JWT_REFRESH_TTL_SECONDS: 3600,
  });

  const res = await injectCookieHandler(config, (reply) => {
    setRefreshCookie(reply, config, "test-token");
  });

  const header = setCookieHeader(res);
  assert.match(header, /dupply_rt=test-token/);
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Lax/i);
  assert.match(header, /Path=\/v1\/auth/);
  assert.match(header, /Max-Age=3600/);
  assert.match(header, /;\s*Secure/i);
});

test("setRefreshCookie in development omits Secure", async () => {
  const config = makeConfig({ NODE_ENV: "development" });

  const res = await injectCookieHandler(config, (reply) => {
    setRefreshCookie(reply, config, "dev-token");
  });

  const header = setCookieHeader(res);
  assert.match(header, /dupply_rt=dev-token/);
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Lax/i);
  assert.doesNotMatch(header, /;\s*Secure/i);
});

test("setRefreshCookie uses JWT_REFRESH_TTL_SECONDS as Max-Age", async () => {
  const config = makeConfig({ JWT_REFRESH_TTL_SECONDS: 3600 });

  const res = await injectCookieHandler(config, (reply) => {
    setRefreshCookie(reply, config, "ttl-token");
  });

  assert.match(setCookieHeader(res), /Max-Age=3600/);
});

test("clearRefreshCookie clears dupply_rt with matching path", async () => {
  const config = makeConfig();

  const app = Fastify({ logger: false });
  await app.register(cookie);
  app.get("/set", async (_request, reply) => {
    setRefreshCookie(reply, config, "to-clear");
    return reply.send({ ok: true });
  });
  app.get("/clear", async (_request, reply) => {
    clearRefreshCookie(reply);
    return reply.send({ ok: true });
  });
  await app.ready();

  const setRes = await app.inject({ method: "GET", url: "/set" });
  assert.match(setCookieHeader(setRes), /dupply_rt=to-clear/);

  const clearRes = await app.inject({ method: "GET", url: "/clear" });
  const clearHeader = setCookieHeader(clearRes);
  assert.match(clearHeader, /dupply_rt=/);
  assert.match(clearHeader, /Path=\/v1\/auth/);
  assert.match(clearHeader, /Max-Age=0|Expires=Thu, 01 Jan 1970/i);

  await app.close();
});
