import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

import type { AppConfig } from "../config.js";

/** Vite dev + preview defaults when `CORS_ALLOWED_ORIGINS` is unset in development. */
const DEV_DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
] as const;

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveAllowedOrigins(config: AppConfig): ReadonlySet<string> {
  const fromEnv = parseAllowedOrigins(config.CORS_ALLOWED_ORIGINS);
  if (fromEnv.length > 0) return new Set(fromEnv);
  if (config.NODE_ENV !== "production") return new Set(DEV_DEFAULT_ORIGINS);
  return new Set();
}

export async function registerCors(app: FastifyInstance, config: AppConfig): Promise<void> {
  const allowed = resolveAllowedOrigins(config);

  if (config.NODE_ENV === "production" && allowed.size === 0) {
    app.log.warn(
      "CORS_ALLOWED_ORIGINS is unset in production — browser SPA requests will be rejected",
    );
  }

  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      // Server-to-server and curl omit Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Dupply-Api-Key"],
  });
}
