import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

export async function registerCookie(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
}
