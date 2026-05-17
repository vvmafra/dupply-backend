/**
 * Esqueleto Dupply indexer — valida env e sai 0.
 * Próximo passo: cliente RPC + cursores de ledger + parse `DuplicataIssued`.
 */
const rpc = process.env.SOROBAN_RPC_URL;
const contract = process.env.DUPLICATA_REGISTRY_CONTRACT_ID;

if (!rpc || !contract) {
  console.error(
    "[dupply-indexer] Defina SOROBAN_RPC_URL e DUPLICATA_REGISTRY_CONTRACT_ID",
  );
  process.exit(1);
}

console.log("[dupply-indexer] OK — RPC e contract definidos.");
console.log("[dupply-indexer] RPC:", rpc);
console.log("[dupply-indexer] Contract:", contract);
console.log("[dupply-indexer] (ingestão ainda não implementada)");
