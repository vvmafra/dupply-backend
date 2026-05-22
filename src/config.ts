import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional().default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("file:./data/dupply.db"),
  DUPPLY_API_KEY: z.string().min(1).optional(),
  ETHERFUSE_BASE_URL: z.string().url().default("https://api.sand.etherfuse.com"),
  ETHERFUSE_API_KEY: z.string().optional(),
  ETHERFUSE_WEBHOOK_SECRET: z.string().optional(),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet", "futurenet"]).default("testnet"),
  SOROBAN_RPC_URL: z.string().url().default("https://soroban-testnet.stellar.org"),
  DUPPLY_REGISTRY_CONTRACT_ID: z.string().optional(),
  /** HS256 signing secret for JWT access tokens (required for `/v1/auth/*` and `/v1/receivables/*`). */
  JWT_SECRET: z.string().min(16).optional(),
  /** Access token TTL in seconds (default 3600). */
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().max(86400).default(3600),
  JWT_ISSUER: z.string().min(1).default("dupply-backend"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  return parsed.data;
}
