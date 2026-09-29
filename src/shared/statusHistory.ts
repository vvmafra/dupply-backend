/**
 * `statusHistory` is a JSON object `{ [status]: ISO timestamp }` recording the first time a
 * receivable entered each status. Pure helper shared by every module that moves a receivable.
 */
export function appendStatusHistory(
  currentHistoryJson: string | null,
  newStatus: string,
  at: Date = new Date(),
): string {
  let history: Record<string, string> = {};
  if (currentHistoryJson) {
    try {
      history = JSON.parse(currentHistoryJson) as Record<string, string>;
    } catch {
      // malformed history: start over rather than fail the transition
    }
  }
  if (!history[newStatus]) {
    history[newStatus] = at.toISOString();
  }
  return JSON.stringify(history);
}
