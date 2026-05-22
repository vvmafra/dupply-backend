import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by `requireJwt` after Bearer verification. */
    auth?: {
      sub: string;
      role: string;
      principalKind: string;
    };
  }
}
