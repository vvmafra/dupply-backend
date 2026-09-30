import { loadConfig } from "../src/infra/env/config.js";
import { createDb } from "../src/infra/database/index.js";
import { receivables, investorInvestments, investors } from "../src/infra/database/schema.runtime.js";
import { eq } from "drizzle-orm";
import { executeSystemPayerSettlement } from "../src/modules/receivable/application/commands/systemPayerSettlementCommand.js";
import { executeSubmitReceivable } from "../src/modules/receivable/application/commands/submitReceivableCommand.js";
import { executeRiskDecision } from "../src/modules/receivable/application/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../src/modules/receivable/application/commands/sellerDecisionCommand.js";

async function main() {
  const config = loadConfig();
  const dbHandle = createDb(config.DATABASE_URL);
  const { db } = dbHandle;

  const rows = await db.select().from(receivables);
  if (rows.length === 0) {
    console.log("Nenhum recebível encontrado no banco de dados. Execute 'npm run seed:dev' primeiro.");
    await dbHandle.close();
    return;
  }

  console.log("\n=== Recebíveis no Banco de Dados ===");
  rows.forEach((r) => {
    console.log(`ID: ${r.id} | Status Atual: ${r.status} | Valor: R$ ${(Number(r.value || 0) / 100).toLocaleString('pt-BR')}`);
  });

  const deps = {
    db,
    config,
    gateways: {} as any
  };

  console.log("\n=== Avançando Ciclo de Vida ===");
  for (const r of rows) {
    if (r.status === "created") {
      // Transiciona de created para under_review
      console.log(`Recebível ${r.id.slice(-6)}: created -> under_review (submetendo para análise)`);
      try {
        await executeSubmitReceivable(deps as any, {
          receivableId: r.id,
          profileId: r.sellerId,
          actorRole: "seller",
        });
      } catch (err: any) {
        console.error(`Erro ao submeter recebível ${r.id}:`, err.message);
      }
    } else if (r.status === "under_review") {
      // Transiciona de under_review para offer
      console.log(`Recebível ${r.id.slice(-6)}: under_review -> offer (criando oferta com 2% de deságio)`);
      try {
        const proposed = (Number(r.value) / 100) * 0.98;
        await executeRiskDecision(deps as any, {
          receivableId: r.id,
          actorRole: "risk_analyst",
          decision: "offer",
          proposedValue: proposed,
        });
      } catch (err: any) {
        console.error(`Erro ao criar oferta para recebível ${r.id}:`, err.message);
      }
    } else if (r.status === "offer") {
      // Transiciona de offer para confirmed
      console.log(`Recebível ${r.id.slice(-6)}: offer -> confirmed (cedente aceitando a proposta)`);
      try {
        await executeSellerDecision(deps as any, {
          receivableId: r.id,
          profileId: r.sellerId,
          actorRole: "seller",
          decision: "accept",
        });
      } catch (err: any) {
        console.error(`Erro ao aceitar oferta para recebível ${r.id}:`, err.message);
      }
    } else if (r.status === "confirmed") {
      // Transiciona de confirmed para funding
      console.log(`Recebível ${r.id.slice(-6)}: confirmed -> funding (aberto para captação)`);
      await db.update(receivables)
        .set({ status: "funding", updatedAt: new Date() })
        .where(eq(receivables.id, r.id));
    } else if (r.status === "completed") {
      // Transiciona de completed para payer_settled usando a lógica oficial de payout
      console.log(`Recebível ${r.id.slice(-6)}: completed -> payer_settled (executando payout e atualizando saldo do investidor)`);
      await executeSystemPayerSettlement(deps, {
        receivableId: r.id,
        outcome: "settled",
      });
    } else if (r.status === "payer_settled") {
      // Transiciona de payer_settled de volta para funding (loop infinito para testes)
      console.log(`Recebível ${r.id.slice(-6)}: payer_settled -> funding (limpando aportes anteriores e resetando saldo do investidor)`);
      
      // Limpa os investimentos associados para permitir investir nela de novo
      await db.delete(investorInvestments).where(eq(investorInvestments.receivableId, r.id));
      
      // Restaura o saldo do investidor para R$ 1.000.000,00
      await db.update(investors).set({ balanceCents: 100000000 });

      // Reseta o status da duplicata
      await db.update(receivables)
        .set({
          status: "funding",
          fundedCents: r.id.includes("7djli8") ? 5000000 : 0, // valores padrão do seed
          updatedAt: new Date()
        })
        .where(eq(receivables.id, r.id));
    } else {
      // Ciclo padrão: funding -> funded -> processing -> completed
      let nextStatus = "funding";
      if (r.status === "funding") {
        nextStatus = "funded";
      } else if (r.status === "funded") {
        nextStatus = "processing";
      } else if (r.status === "processing") {
        nextStatus = "completed";
      }

      await db.update(receivables)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(receivables.id, r.id));
      console.log(`Recebível ${r.id.slice(-6)}: ${r.status} -> ${nextStatus}`);
    }
  }

  console.log("\nAtualização concluída com sucesso! Atualize o dashboard para ver as alterações.");
  await dbHandle.close();
}

main().catch(console.error);
