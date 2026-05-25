import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executeRegisterSellerWallet } from "../../application/wallet/commands/registerSellerWalletCommand.js";
import { executeUpdateWalletStatus } from "../../application/wallet/commands/updateWalletStatusCommand.js";
import { executeGetSellerWallet } from "../../application/wallet/queries/getSellerWalletQuery.js";
import { executeGetWalletById } from "../../application/wallet/queries/getWalletByIdQuery.js";
import {
  WALLET_ERROR_CODES,
  WalletError,
  type WalletErrorCode,
} from "../../domain/wallet/errors.js";
import { requireRoles } from "../../plugins/require-roles.js";

const registerWalletBodySchema = z.object({
  contractId: z.string().min(1),
  credentialId: z.string().min(1),
  signerPublicKey: z.string().min(1),
  network: z.enum(["testnet", "mainnet"]),
  createdTxHash: z.string().min(1).optional(),
});

const walletStatusBodySchema = z.object({
  status: z.enum(["active", "inactive"]),
});

const sellerIdParamsSchema = z.object({ id: z.string().min(1) });
const walletIdParamsSchema = z.object({ id: z.string().min(1) });

const WALLET_ERROR_HTTP: Partial<Record<WalletErrorCode, number>> = {
  [WALLET_ERROR_CODES.NOT_FOUND]: 404,
  [WALLET_ERROR_CODES.SELLER_NOT_FOUND]: 404,
  [WALLET_ERROR_CODES.FORBIDDEN]: 403,
  [WALLET_ERROR_CODES.SELLER_NOT_ACTIVE]: 403,
  [WALLET_ERROR_CODES.WALLET_ALREADY_EXISTS]: 409,
  [WALLET_ERROR_CODES.VALIDATION_ERROR]: 400,
  [WALLET_ERROR_CODES.INVALID_WALLET_STATUS]: 400,
};

function mapWalletError(
  e: unknown,
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
): unknown {
  if (e instanceof WalletError) {
    const status = WALLET_ERROR_HTTP[e.code] ?? 400;
    return reply.code(status).send({ error: e.code });
  }
  return undefined;
}

export async function registerWalletRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/sellers/:id/wallet",
    {
      schema: {
        tags: ["Wallets"],
        summary: "Registrar wallet do seller após criação via SDK",
        params: sellerIdParamsSchema,
        body: registerWalletBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        const wallet = await executeRegisterSellerWallet(deps, {
          actor: { profileId: request.auth.profileId, role: request.auth.role },
          sellerId: request.params.id,
          payload: request.body,
        });
        return reply.code(201).send(wallet);
      } catch (e) {
        const mapped = mapWalletError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.get(
    "/v1/sellers/:id/wallet",
    {
      schema: {
        tags: ["Wallets"],
        summary: "Buscar wallet do seller",
        params: sellerIdParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        return await executeGetSellerWallet(deps, {
          actor: {
            sub: request.auth.sub,
            role: request.auth.role,
            profileId: request.auth.profileId,
          },
          sellerId: request.params.id,
        });
      } catch (e) {
        const mapped = mapWalletError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.get(
    "/v1/wallets/:id",
    {
      schema: {
        tags: ["Wallets"],
        summary: "Buscar wallet por ID",
        params: walletIdParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        return await executeGetWalletById(deps, {
          actor: { profileId: request.auth.profileId, role: request.auth.role },
          walletId: request.params.id,
        });
      } catch (e) {
        const mapped = mapWalletError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.patch(
    "/v1/wallets/:id/status",
    {
      preHandler: requireRoles("admin"),
      schema: {
        tags: ["Wallets"],
        summary: "Ativar ou desativar wallet (admin)",
        params: walletIdParamsSchema,
        body: walletStatusBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        return await executeUpdateWalletStatus(deps, {
          walletId: request.params.id,
          status: request.body.status,
          actor: { role: request.auth!.role },
        });
      } catch (e) {
        const mapped = mapWalletError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );
}
