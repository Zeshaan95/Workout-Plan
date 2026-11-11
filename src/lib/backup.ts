import { TABLES, type HubDB } from '../db';

export const BACKUP_APP = 'fat-loss-hub';
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export async function exportAll(db: HubDB): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) tables[t] = await db.table(t).toArray();
  });
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

export function validateBackup(data: unknown): asserts data is Backup {
  const b = data as Backup;
  if (!b || b.app !== BACKUP_APP || typeof b.tables !== 'object') {
    throw new Error('This file is not a Fat-Loss Hub backup.');
  }
  if (b.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of the app.');
}

/** Replace everything with the backup's contents. */
export async function importAll(db: HubDB, data: unknown): Promise<void> {
  validateBackup(data);
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = data.tables[t];
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows);
    }
  });
}

export async function resetAll(db: HubDB): Promise<void> {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear();
  });
}
