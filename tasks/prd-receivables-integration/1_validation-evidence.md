# Validation evidence — Task API-1: Atomic create + submit endpoint

## Changes made

- `src/application/receivable/commands/createAndSubmitReceivableCommand.ts`: novo command `executeCreateAndSubmitReceivable` que reutiliza guards de create (seller active, CNPJ diferente), valida metadata completa via `assertReceivableMetaDataComplete`, faz upsert do payer e insere receivable diretamente com `status=under_review` após assert das transições `null→created` e `created→under_review`.
- `src/routes/v1/receivables.ts`: nova rota `POST /v1/receivables/submit` (auth seller, body igual ao create) retornando `201 { id, status: "under_review" }` com mapeamento de erros existente (`seller_not_active`, `incomplete_metadata`, etc.).
- `tests/application/receivable/createAndSubmitReceivableCommand.test.ts`: testes unitários do command (sucesso, metadata incompleta, seller inativo, CNPJ igual).
- `tests/routes/v1/receivables.test.ts`: testes de rota (403 admin, 201 sucesso, 400 incomplete_metadata, 403 seller inativo).

## Test results

```
node --import tsx --test tests/application/receivable/createAndSubmitReceivableCommand.test.ts tests/routes/v1/receivables.test.ts → ✅ 15 passing
npm run lint → ⚠️ 2 erros pré-existentes em src/db/transaction.ts (não introduzidos por esta task)
```

## Success criteria

- [x] `POST /v1/receivables/submit` aceita o mesmo body do create e retorna `201 { id, status: "under_review" }` — verificado em teste de rota.
- [x] Seller active guard igual ao create — verificado em testes unitário e de rota (`seller_not_active`).
- [x] Metadata completa validada antes de persistir — `incomplete_metadata` em testes unitário e de rota.
- [x] Upsert payer por CNPJ — reutiliza `upsertPayerByCnpj`; receivable criado com `payerId` no teste de sucesso.
- [x] Receivable persiste em `under_review` (sem rascunho intermediário exposto) — verificado no DB nos testes.

## Notes

- Optou-se por insert único com `under_review` em vez de transação create+update, após validação upfront — semanticamente equivalente e alinhado ao padrão do `executeCreateReceivable` (sem transação explícita hoje).
- `npm run lint` falha por erros TS pré-existentes em `src/db/transaction.ts`, fora do escopo desta task.
