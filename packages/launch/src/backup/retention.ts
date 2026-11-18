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

export interface GfsPolicy {
  target: BackupTarget;
  /** Newest backup of each of this many most recent days that have a backup. */
  daily: number;
  /** Then the newest older backup of each of this many most recent weeks (Monday to Sunday, UTC). */
  weekly: number;
  /** Hard age limit. Used for the keys database, whose backups must not outlive the shredded keys (SECURITY section 10). */
  maxAgeDays?: number;
}

const DAY_MS = 86_400_000;
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
function weekKey(date: Date): string {
  const monday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return dayKey(new Date(monday - ((date.getUTCDay() + 6) % 7) * DAY_MS));
}

/**
 * The backups to delete under a grandfather rule: 14 daily plus 8 weekly by default. Slots count days and weeks that
 * actually have a backup, so a long outage of the job never erodes the good copies. The newest backup is never selected.
 * Only well formed names of the policy's own target are ever returned.
 */
export function selectExpiredGfs<T extends StoredBackup>(
  all: T[],
  policy: GfsPolicy,
  now: Date,
): T[] {
  if (!(policy.daily >= 1)) throw new Error('daily must be at least 1');
  if (!(policy.weekly >= 0)) throw new Error('weekly cannot be negative');
  if (policy.maxAgeDays !== undefined && !(policy.maxAgeDays >= 1))
    throw new Error('maxAgeDays must be at least 1');
  const own = all
    .map((item) => ({ item, takenAt: parseBackupKey(item.key) }))
    .filter(
      (entry): entry is { item: T; takenAt: { target: BackupTarget; takenAt: Date } } =>
        entry.takenAt?.target === policy.target,
    )
    .map((entry) => ({ item: entry.item, at: entry.takenAt.takenAt }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  const keep = new Set<T>();
  const days = new Set<string>();
  for (const entry of own) {
    const day = dayKey(entry.at);
    if (days.has(day) || days.size >= policy.daily) continue;
    days.add(day);
    keep.add(entry.item);
  }
  const weeks = new Set<string>();
  for (const entry of own) {
    if (keep.has(entry.item) || dayKey(entry.at) >= [...days].sort()[0]!) continue;
    const week = weekKey(entry.at);
    if (weeks.has(week) || weeks.size >= policy.weekly) continue;
    weeks.add(week);
    keep.add(entry.item);
  }
  if (policy.maxAgeDays !== undefined) {
    const cutoff = now.getTime() - policy.maxAgeDays * DAY_MS;
    for (const entry of own.slice(1)) if (entry.at.getTime() < cutoff) keep.delete(entry.item);
    if (own[0] && own[0].at.getTime() < cutoff) keep.add(own[0].item);
  }
  return own.filter((entry) => !keep.has(entry.item)).map((entry) => entry.item);
}
