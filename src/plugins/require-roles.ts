import type { FastifyReply, FastifyRequest } from "fastify";

import type { AccountRole } from "../domain/account/types.js";

export function requireRoles(...allowed: AccountRole[]) {
  return async function requireRolesHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.auth) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    if (!allowed.includes(request.auth.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
}
