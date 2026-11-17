import { uuidv7 } from '@ad/shared';
import type { SettingRow, SettingUpsert, SettingsStore, SettingsTx } from './settings-store';
import type { AuditEntry, ListFilter, NewThemeRow, ThemeRow, ThemeStore, ThemeTx } from './store';

/** In memory store with the same invariants as the database indexes. For unit tests. */
export class MemoryThemeStore implements ThemeStore {
  rows: ThemeRow[] = [];
  audit = new MemoryAudit();
  failNextRead = false;
  reads = 0;
  private lock: Promise<unknown> = Promise.resolve();

  async transaction<T>(fn: (tx: ThemeTx) => Promise<T>): Promise<T> {
    const run = this.lock.then(async () => {
      const snapshot = this.rows.map((row) => ({ ...row }));
      const auditCount = this.audit.entries.length;
      try {
        return await fn(this.tx());
      } catch (error) {
        this.rows = snapshot;
        this.audit.entries.length = auditCount;
        throw error;
      }
    });
    this.lock = run.catch(() => undefined);
    return run;
  }

  async published(): Promise<ThemeRow | null> {
    this.reads += 1;
    if (this.failNextRead) {
      this.failNextRead = false;
      throw new Error('database unavailable');
    }
    return this.rows.find((row) => row.status === 'published') ?? null;
  }

  private assertUnique(candidate: ThemeRow, ignoreId?: string) {
    for (const row of this.rows) {
      if (row.id === ignoreId) continue;
      if (row.version === candidate.version) throw new Error('duplicate version');
      if (candidate.status !== 'archived' && row.status === candidate.status) {
        throw new Error(`duplicate ${candidate.status}`);
      }
    }
  }

  private tx(): ThemeTx {
    const kindOf = (row: ThemeRow) => (row.publishedAt ? 'published' : 'draft');
    return {
      findByStatus: async (status) => this.rows.find((row) => row.status === status) ?? null,
      findById: async (id) => this.rows.find((row) => row.id === id) ?? null,
      list: async (filter: ListFilter) =>
        this.rows
          .filter((row) => !filter.kind || kindOf(row) === filter.kind)
          .filter((row) => filter.beforeVersion === undefined || row.version < filter.beforeVersion)
          .sort((a, b) => b.version - a.version)
          .slice(0, filter.limit),
      count: async (kind) => this.rows.filter((row) => !kind || kindOf(row) === kind).length,
      nextVersion: async () => Math.max(0, ...this.rows.map((row) => row.version)) + 1,
      insert: async (input: NewThemeRow) => {
        const row: ThemeRow = { id: uuidv7(), createdAt: new Date(), ...input };
        this.assertUnique(row);
        this.rows.push(row);
        return { ...row };
      },
      audit: async (entry) => this.audit.record(entry),
      update: async (id, patch) => {
        const index = this.rows.findIndex((row) => row.id === id);
        if (index < 0) throw new Error('missing row');
        const next = { ...this.rows[index]!, ...patch };
        this.assertUnique(next, id);
        this.rows[index] = next;
        return { ...next };
      },
    };
  }
}

export class MemoryAudit {
  entries: AuditEntry[] = [];
  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

export class MemorySettingsStore implements SettingsStore {
  rows = new Map<string, SettingRow>();
  audit = new MemoryAudit();
  failReads = false;
  readAllCalls = 0;
  private lock: Promise<unknown> = Promise.resolve();

  async readAll(): Promise<SettingRow[]> {
    this.readAllCalls += 1;
    if (this.failReads) throw new Error('database unavailable');
    return [...this.rows.values()].map((row) => ({ ...row }));
  }

  async readOne(key: string): Promise<SettingRow | null> {
    if (this.failReads) throw new Error('database unavailable');
    const row = this.rows.get(key);
    return row ? { ...row } : null;
  }

  async transaction<T>(fn: (tx: SettingsTx) => Promise<T>): Promise<T> {
    const run = this.lock.then(async () => {
      const snapshot = new Map([...this.rows].map(([key, row]) => [key, { ...row }]));
      const auditCount = this.audit.entries.length;
      try {
        return await fn({
          get: async (key) => {
            const row = this.rows.get(key);
            return row ? { ...row } : null;
          },
          upsert: async (input: SettingUpsert) => {
            const row: SettingRow = {
              key: input.key,
              value: structuredClone(input.value),
              isPublic: input.isPublic,
              description: input.description ?? null,
              updatedBy: input.updatedBy,
              updatedAt: new Date(),
            };
            this.rows.set(input.key, row);
            return { ...row };
          },
          audit: async (entry) => this.audit.record(entry),
        });
      } catch (error) {
        this.rows = snapshot;
        this.audit.entries.length = auditCount;
        throw error;
      }
    });
    this.lock = run.catch(() => undefined);
    return run;
  }
}
