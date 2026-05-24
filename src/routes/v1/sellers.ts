import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executeGetSeller } from "../../application/seller/queries/getSellerQuery.js";
import { executeListSellers } from "../../application/seller/queries/listSellersQuery.js";
import { executeSoftDeleteSeller } from "../../application/seller/commands/softDeleteSellerCommand.js";
import { executeSubmitSellerForReview } from "../../application/seller/commands/submitSellerForReviewCommand.js";
import { executeTransitionSellerStatus } from "../../application/seller/commands/transitionSellerStatusCommand.js";
import { executeUpdateSellerMetadata } from "../../application/seller/commands/updateSellerMetadataCommand.js";
import {
  SELLER_ERROR_CODES,
  SellerError,
  type SellerErrorCode,
} from "../../domain/seller/errors.js";
import { SELLER_STATUSES } from "../../domain/seller/types.js";
import { requireRoles } from "../../plugins/require-roles.js";

const addressSchema = z.object({
  zipCode: z.string(),
  state: z.string(),
  street: z.string(),
  number: z.string(),
  complement: z.string().optional(),
  neighborhood: z.string(),
  city: z.string(),
});

const companyMetaDataSchema = z.object({
  legalName: z.string().optional(),
  cnpj: z.string().optional(),
  foundingDate: z.string().optional(),
  shareCapital: z.number().nonnegative().multipleOf(0.01).optional(),
  annualRevenue: z.number().nonnegative().multipleOf(0.01).optional(),
  corporateEmail: z.string().optional(),
  phone: z.string().optional(),
  businessDescription: z.string().optional(),
  address: addressSchema.optional(),
});

const legalRepMetaDataSchema = z.object({
  fullName: z.string().optional(),
  cpf: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
});

const businessRelationSchema = z.object({
  legalName: z.string(),
  cnpj: z.string(),
  sharePercentage: z.number().optional(),
});

const businessRelationsMetaDataSchema = z.object({
  clients: z.array(businessRelationSchema).optional(),
  suppliers: z.array(businessRelationSchema).optional(),
});

const updateSellerBodySchema = z.object({
  name: z.string().min(1).optional(),
  companyMetaData: companyMetaDataSchema.optional(),
  legalRepresentativeMetaData: legalRepMetaDataSchema.optional(),
  businessRelationsMetaData: businessRelationsMetaDataSchema.optional(),
});

const statusBodySchema = z.object({
  status: z.enum(["active", "inactive"]),
});

const listQuerySchema = z.object({
  status: z.enum(SELLER_STATUSES).optional(),
});

const sellerIdParamsSchema = z.object({ id: z.string().min(1) });

const SELLER_ERROR_HTTP: Partial<Record<SellerErrorCode, number>> = {
  [SELLER_ERROR_CODES.NOT_FOUND]: 404,
  [SELLER_ERROR_CODES.FORBIDDEN]: 403,
  [SELLER_ERROR_CODES.METADATA_LOCKED]: 409,
  [SELLER_ERROR_CODES.VALIDATION_ERROR]: 400,
  [SELLER_ERROR_CODES.INCOMPLETE_METADATA]: 400,
  [SELLER_ERROR_CODES.INVALID_STATUS_TRANSITION]: 409,
};

function mapSellerError(e: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }): unknown {
  if (e instanceof SellerError) {
    const status = SELLER_ERROR_HTTP[e.code] ?? 400;
    return reply.code(status).send({ error: e.code });
  }
  return undefined;
}

export async function registerSellerRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get(
    "/v1/sellers",
    {
      schema: {
        tags: ["Sellers"],
        summary: "Listar sellers",
        querystring: listQuerySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        const sellers = await executeListSellers(deps, {
          actor: { role: request.auth.role },
          status: request.query.status,
        });
        return sellers;
      } catch (e) {
        const mapped = mapSellerError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.get(
    "/v1/sellers/:id",
    {
      schema: {
        tags: ["Sellers"],
        summary: "Buscar seller por ID",
        params: sellerIdParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        return await executeGetSeller(deps, {
          actor: {
            sub: request.auth.sub,
            role: request.auth.role,
            profileId: request.auth.profileId,
          },
          sellerId: request.params.id,
        });
      } catch (e) {
        const mapped = mapSellerError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.patch(
    "/v1/sellers/:id",
    {
      schema: {
        tags: ["Sellers"],
        summary: "Atualizar metadata do seller",
        params: sellerIdParamsSchema,
        body: updateSellerBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        return await executeUpdateSellerMetadata(
          deps,
          { profileId: request.auth.profileId },
          request.params.id,
          request.body,
        );
      } catch (e) {
        const mapped = mapSellerError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.post(
    "/v1/sellers/:id/submit",
    {
      schema: {
        tags: ["Sellers"],
        summary: "Enviar seller para revisão",
        params: sellerIdParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        await executeSubmitSellerForReview(
          deps,
          { profileId: request.auth.profileId },
          request.params.id,
        );
        return reply.code(204).send();
      } catch (e) {
        const mapped = mapSellerError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.patch(
    "/v1/sellers/:id/status",
    {
      preHandler: requireRoles("admin"),
      schema: {
        tags: ["Sellers"],
        summary: "Transicionar status do seller (admin)",
        params: sellerIdParamsSchema,
        body: statusBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        await executeTransitionSellerStatus(deps, {
          sellerId: request.params.id,
          targetStatus: request.body.status,
          actor: { role: request.auth!.role },
        });
        return reply.code(204).send();
      } catch (e) {
        const mapped = mapSellerError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.delete(
    "/v1/sellers/:id",
    {
      preHandler: requireRoles("admin"),
      schema: {
        tags: ["Sellers"],
        summary: "Soft-delete de seller",
        params: sellerIdParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        await executeSoftDeleteSeller(deps, request.params.id);
        return reply.code(204).send();
      } catch (e) {
        const mapped = mapSellerError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );
}
