import "fastify";

import type { AccountRole } from "../domain/account/types.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by `requireJwt` after Bearer verification. */
    auth?: {
      sub: string;
      role: AccountRole;
      profileId: string;
    };
  }
}
