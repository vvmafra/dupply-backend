import assert from "node:assert/strict";
import test from "node:test";

import type { FastifyReply, FastifyRequest } from "fastify";

import { requireRoles } from "../../src/plugins/require-roles.js";

function mockReply(): FastifyReply & {
  statusCode?: number;
  body?: unknown;
} {
  const reply = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    code(status: number) {
      reply.statusCode = status;
      return {
        send: (body: unknown) => {
          reply.body = body;
          return reply;
        },
      };
    },
  };
  return reply as unknown as FastifyReply & { statusCode?: number; body?: unknown };
}

function mockRequest(auth?: { sub: string; role: string; profileId: string }): FastifyRequest {
  return { auth } as FastifyRequest;
}

test("requireRoles returns 401 when auth is missing", async () => {
  const hook = requireRoles("admin");
  const request = mockRequest(undefined);
  const reply = mockReply();

  await hook(request, reply);

  assert.equal(reply.statusCode, 401);
  assert.deepEqual(reply.body, { error: "unauthorized" });
});

test("requireRoles returns 403 when role is not allowed", async () => {
  const hook = requireRoles("admin");
  const request = mockRequest({ sub: "u1", role: "seller", profileId: "p1" });
  const reply = mockReply();

  await hook(request, reply);

  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.body, { error: "forbidden" });
});

test("requireRoles resolves when single role matches", async () => {
  const hook = requireRoles("admin");
  const request = mockRequest({ sub: "u1", role: "admin", profileId: "p1" });
  const reply = mockReply();

  await hook(request, reply);

  assert.equal(reply.statusCode, undefined);
  assert.equal(reply.body, undefined);
});

test("requireRoles resolves when role matches one of multiple allowed", async () => {
  const hook = requireRoles("risk_analyst", "risk_analyst_agent");
  const request = mockRequest({ sub: "u1", role: "risk_analyst", profileId: "p1" });
  const reply = mockReply();

  await hook(request, reply);

  assert.equal(reply.statusCode, undefined);
  assert.equal(reply.body, undefined);
});

test("requireRoles returns 403 when allow-list is empty", async () => {
  const hook = requireRoles();
  const request = mockRequest({ sub: "u1", role: "admin", profileId: "p1" });
  const reply = mockReply();

  await hook(request, reply);

  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.body, { error: "forbidden" });
});
