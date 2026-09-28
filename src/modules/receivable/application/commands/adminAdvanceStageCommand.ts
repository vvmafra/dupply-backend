import type { AppDeps } from "../../../../compose/deps.js";
import { RECEIVABLE_STATUS, ReceivableTransitionError, type ReceivableStatus } from "../../domain/transitions.js";
import { loadReceivableOrThrow } from "../receivableHelpers.js";
import { executeSystemAdvanceSettlement } from "./systemAdvanceSettlementCommand.js";
import { executeSystemPayerSettlement } from "./systemPayerSettlementCommand.js";

export type AdminAdvanceStageInput = {
  receivableId: string;
};

export type AdminAdvanceStageResult = {
  from: ReceivableStatus;
  to: ReceivableStatus;
};

/**
 * Admin "advance stage" trigger. Maps the current post-funding status to the next one and
 * delegates to the existing system commands so the domain guard and the pro-rata payout on
 * `payer_settled` are reused:
 *
 *   funded     → processing
 *   processing → completed
 *   completed  → payer_settled   (runs executeSystemPayerSettlement → payout)
 *
 * Any other status throws `ReceivableTransitionError("invalid_admin_stage_advance")`.
 */
export async function executeAdminAdvanceStage(
  deps: AppDeps,
  input: AdminAdvanceStageInput,
): Promise<AdminAdvanceStageResult> {
  const row = await loadReceivableOrThrow(deps, input.receivableId);
  const from = row.status as ReceivableStatus;

  switch (from) {
    case RECEIVABLE_STATUS.FUNDED:
      await executeSystemAdvanceSettlement(deps, {
        receivableId: input.receivableId,
        targetStatus: RECEIVABLE_STATUS.PROCESSING,
      });
      return { from, to: RECEIVABLE_STATUS.PROCESSING };
    case RECEIVABLE_STATUS.PROCESSING:
      await executeSystemAdvanceSettlement(deps, {
        receivableId: input.receivableId,
        targetStatus: RECEIVABLE_STATUS.COMPLETED,
      });
      return { from, to: RECEIVABLE_STATUS.COMPLETED };
    case RECEIVABLE_STATUS.COMPLETED:
      await executeSystemPayerSettlement(deps, {
        receivableId: input.receivableId,
        outcome: "settled",
      });
      return { from, to: RECEIVABLE_STATUS.PAYER_SETTLED };
    default:
      throw new ReceivableTransitionError("invalid_admin_stage_advance");
  }
}
