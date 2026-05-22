# Etherfuse KYC programático (sandbox)

**Objetivo:** aprovar KYC sem UI (`devnet.etherfuse.com/ramp/onboarding`) quando a interface trava.

**Refs oficiais:**

- [Onboard — Programmatic](https://docs.etherfuse.com/guides/onboarding-programmatic)
- [Submit KYC identity](https://docs.etherfuse.com/api-reference/kyc/submit-kyc-identity-data)
- [Get KYC status](https://docs.etherfuse.com/api-reference/kyc/get-kyc-status)

## Código

- Cliente: `src/integrations/etherfuse/client.ts` — `createChildOrganization`, `submitKycIdentity`, `uploadKycDocuments`, `getKycStatus`
- Smoke: `npm run etherfuse:kyc-smoke` (`scripts/etherfuse-kyc-smoke.ts`)

## Pré-requisitos

1. `ETHERFUSE_API_KEY` = chave em **Ramp → API Keys** (sandbox), **não** URL de documentação.
2. `ETHERFUSE_BASE_URL=https://api.sand.etherfuse.com`

## Fluxo smoke (personal)

1. `POST /ramp/organization` — child org + wallet Stellar (omitir se já existe: `ETHERFUSE_KYC_SKIP_ORG=1`)
2. `POST /ramp/customer/{id}/kyc` — identidade MX de exemplo (sandbox personal → auto-approve)
3. Poll `GET /ramp/customer/{id}/kyc/{pubkey}` até `approved` ou `approved_chain_deploying`

## Cliente já criado via onboarding-url (2026-05-16)

```bash
ETHERFUSE_KYC_CUSTOMER_ID=6a1f11f2-9749-48b6-b374-9a394a87c67d
ETHERFUSE_KYC_WALLET=GAQ2I4ZZIM4HITHEBI5AWNDVVE6QTSFY5VYIUV5OVJXLUEN5OBTFKCC7
ETHERFUSE_KYC_SKIP_ORG=1
npm run etherfuse:kyc-smoke
```

## Teste executado

- 2026-05-22: `ETHERFUSE_KYC_SKIP_ORG=1` + customer/wallet do onboarding-url → **`status: approved`** (sandbox auto-approve).
- Correção: body exige `identity.id` (= pubkey Stellar); ver `regional-starter-pack` `EtherfuseKycIdentityRequest`.

## Rollback

Nenhuma migração BD; só cliente HTTP + script. Remover métodos KYC do client se regressão.
