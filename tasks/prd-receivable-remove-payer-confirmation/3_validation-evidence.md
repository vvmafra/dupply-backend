# Validation evidence — Task 3.0: Seller decision command + payer notification port stub

## Changes made

- `src/application/payer/ports/receivableNotification.ts`: novo port stub `notifyPayerReceivableConfirmed` (no-op; hook para Module 4).
- `src/application/receivable/commands/sellerDecisionCommand.ts`: accept já mapeava para `CONFIRMED`; adicionado hook pós-UPDATE que chama o port com try/catch e log `payer_notification_failed` em warn.
- `src/application/deps.ts`: `logger?` e `notifyPayerReceivableConfirmed?` opcionais para logging e override em testes.
- `tests/application/receivable/sellerDecisionCommand.test.ts`: testes para reject → `rejected`, accept → `confirmed`, e falha de notificação sem rollback.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 280 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — `tsc -p tsconfig.json` sem erros.
- [x] Unit tests pass (`npm test`) — 280 testes passando.
- [x] Accept on `offer` sets DB status to `confirmed` — teste `seller accept transitions offer → confirmed`.
- [x] Reject on `offer` sets DB status to `rejected` — teste `seller reject transitions offer → rejected`.
- [x] When notification stub throws, command still resolves and status remains `confirmed` — teste `notification failure does not fail seller accept` com override em deps e assert de `warnCalled`.
- [x] No pre-existing tests broken — suite completa verde.

## Notes

- O target `CONFIRMED` no accept já estava implementado (provavelmente parcialmente na task 1.0); esta task completou o hook de notificação e a cobertura de testes.
- `AppDeps` ganhou `logger?` e `notifyPayerReceivableConfirmed?` opcionais: necessário para o log warn da techspec e para simular falha de transporte em testes (Node 20 não expõe `mock.module`).
- Em produção, o comando usa o port stub importado quando `deps.notifyPayerReceivableConfirmed` não está definido — comportamento idêntico à techspec.
