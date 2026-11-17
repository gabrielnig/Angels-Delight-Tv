import type { AuditEntry } from './store';

export interface SettingRow {
  key: string;
  value: unknown;
  isPublic: boolean;
  description: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface SettingUpsert {
  key: string;
  value: unknown;
  isPublic: boolean;
  description?: string | null;
  updatedBy: string;
}

export interface SettingsTx {
  get(key: string): Promise<SettingRow | null>;
  upsert(input: SettingUpsert): Promise<SettingRow>;
  /** Written in the same transaction as the change. */
  audit(entry: AuditEntry): Promise<void>;
}

export interface SettingsStore {
  readAll(): Promise<SettingRow[]>;
  readOne(key: string): Promise<SettingRow | null>;
  /** Serialises writers with a lock, so two admins saving a page cannot lose a version. */
  transaction<T>(fn: (tx: SettingsTx) => Promise<T>): Promise<T>;
}
