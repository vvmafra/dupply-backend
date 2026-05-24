import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

import type { AppConfig } from "../config.js";

export async function registerSwagger(app: FastifyInstance, config: AppConfig): Promise<void> {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Dupply API",
        description:
          "API do backend Dupply — plataforma de antecipação de recebíveis.\n\n" +
          "**Auth JWT** (`bearerAuth`): rotas de contas, sellers e recebíveis.\n\n" +
          "**API Key** (`dupplyApiKey`): rotas de ramp, trade bills e workers internos.",
        version: "0.1.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Access token obtido via POST /v1/auth/login",
          },
          dupplyApiKey: {
            type: "apiKey",
            in: "header",
            name: "x-dupply-api-key",
            description: "Chave de API para serviços internos (workers, BFF)",
          },
        },
      },
      tags: [
        { name: "Auth", description: "Registro, login, refresh e logout" },
        { name: "Accounts", description: "Gerenciamento de conta do usuário" },
        { name: "Sellers", description: "Perfil e ciclo de vida de vendedores" },
        { name: "Receivables", description: "Criação e gestão de recebíveis" },
        { name: "Ramp", description: "On/off-ramp via Etherfuse" },
        { name: "Trade Bills", description: "Duplicatas on-chain via Soroban" },
        { name: "Internal", description: "Endpoints internos (workers/BFF)" },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
  });
}
