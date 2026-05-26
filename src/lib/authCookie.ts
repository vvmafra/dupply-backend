import type { FastifyReply } from "fastify";

import type { AppConfig } from "../config.js";

export const REFRESH_COOKIE_NAME = "dupply_rt";
export const REFRESH_COOKIE_PATH = "/v1/auth";

export function setRefreshCookie(
  reply: FastifyReply,
  config: AppConfig,
  plainToken: string,
): void {
  reply.setCookie(REFRESH_COOKIE_NAME, plainToken, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: config.JWT_REFRESH_TTL_SECONDS,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}
