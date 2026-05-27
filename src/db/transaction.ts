import { isPostgresDatabaseUrl } from "./dialect.js";
import type { Db } from "./index.js";

type Runnable = Promise<unknown> | { run: () => void };

export type TxExec = (op: Runnable) => void;

/**
 * Runs `fn` inside a DB transaction for SQLite (sync `.run()`) or Postgres (awaited promises).
 */
export async function runTransaction(
  db: Db,
  databaseUrl: string,
  fn: (tx: Db, exec: TxExec) => void,
): Promise<void> {
  if (isPostgresDatabaseUrl(databaseUrl)) {
    await db.transaction(async (tx) => {
      const pending: Promise<unknown>[] = [];
      const exec: TxExec = (op) => {
        pending.push(op as Promise<unknown>);
      };
      fn(tx as Db, exec);
      await Promise.all(pending);
    });
    return;
  }

  db.transaction((tx) => {
    const exec: TxExec = (op) => {
      (op as { run: () => void }).run();
    };
    fn(tx as Db, exec);
  });
}
