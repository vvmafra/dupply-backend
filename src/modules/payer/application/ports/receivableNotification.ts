import type { AppDeps } from "../../../../compose/deps.js";

export type NotifyPayerReceivableConfirmedInput = {
  receivableId: string;
  payerId: string;
};

/** Stub — Module 4 will send informational email (duplicata discounted, pay Dupply at due date). */
export async function notifyPayerReceivableConfirmed(
  _deps: AppDeps,
  _input: NotifyPayerReceivableConfirmedInput,
): Promise<void> {
  // no-op in v1 of this feature; hook point for Module 4
}
