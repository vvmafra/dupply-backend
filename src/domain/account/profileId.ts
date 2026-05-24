import type { AccountRole } from "./types.js";

/** TEMP: replace with real profile FK lookup when profile modules land. */
// @todo(module-2|3)
export function mockProfileId(accountId: string, role: AccountRole): string {
  return `placeholder-${role}-${accountId}`;
}
