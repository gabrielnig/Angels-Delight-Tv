export type BackupTarget = 'db' | 'keys';

const PREFIX: Record<BackupTarget, string> = { db: 'ad', keys: 'ad_keys' };
const PATTERN = /^(db|keys)\/(ad|ad_keys)-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.dump\.enc$/;

export interface StoredBackup {
  key: string;
}

/** `db/ad-20261118T023005Z.dump.enc`: the time is in the name, so retention never depends on file dates. */
export function backupKey(target: BackupTarget, takenAt: Date): string {
  const stamp = takenAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `${target}/${PREFIX[target]}-${stamp}.dump.enc`;
}

export function parseBackupKey(key: string): { target: BackupTarget; takenAt: Date } | null {
  const match = PATTERN.exec(key);
  if (!match) return null;
  const [, target, prefix, y, mo, d, h, mi, s] = match;
  if (PREFIX[target as BackupTarget] !== prefix) return null;
  const takenAt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return Number.isNaN(takenAt.getTime()) ? null : { target: target as BackupTarget, takenAt };
}

export interface RetentionPolicy {
  target: BackupTarget;
  /** Backups older than this are expired. */
  maxAgeDays: number;
  /** The newest backups that are always kept, so a long outage of the backup job never deletes the last good copies. */
  minKeep: number;
}

/** The backups to delete. Only well formed names of the policy's own target are ever returned. */
export function selectExpired<T extends StoredBackup>(
  all: T[],
  policy: RetentionPolicy,
  now: Date,
): T[] {
  if (!(policy.maxAgeDays >= 1)) throw new Error('maxAgeDays must be at least 1');
  if (!(policy.minKeep >= 0)) throw new Error('minKeep cannot be negative');
  const own = all
    .map((item) => ({ item, parsed: parseBackupKey(item.key) }))
    .filter((entry) => entry.parsed?.target === policy.target)
    .sort((a, b) => b.parsed!.takenAt.getTime() - a.parsed!.takenAt.getTime());
  const cutoff = now.getTime() - policy.maxAgeDays * 86_400_000;
  return own
    .slice(policy.minKeep)
    .filter((entry) => entry.parsed!.takenAt.getTime() < cutoff)
    .map((entry) => entry.item);
}
