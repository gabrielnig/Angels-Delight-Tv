import { describe, expect, it } from 'vitest';
import {
  backupKey,
  parseBackupKey,
  selectExpired,
  selectExpiredGfs,
  type StoredBackup,
} from './retention';

const at = (iso: string) => new Date(iso);

describe('backupKey and parseBackupKey', () => {
  it('names a backup by target and UTC time and parses it back', () => {
    const key = backupKey('db', at('2026-11-18T02:30:05Z'));
    expect(key).toBe('db/ad-20261118T023005Z.dump.enc');
    expect(parseBackupKey(key)).toEqual({ target: 'db', takenAt: at('2026-11-18T02:30:05Z') });
    expect(backupKey('keys', at('2026-01-02T03:04:05Z'))).toBe(
      'keys/ad_keys-20260102T030405Z.dump.enc',
    );
  });

  it('ignores anything that is not a backup name', () => {
    expect(parseBackupKey('db/readme.txt')).toBeNull();
    expect(parseBackupKey('db/ad-2026.dump.enc')).toBeNull();
    expect(parseBackupKey('other/ad-20261118T023005Z.dump.enc')).toBeNull();
  });
});

function make(target: 'db' | 'keys', daysAgo: number[], now: Date): StoredBackup[] {
  return daysAgo.map((days) => ({
    key: backupKey(target, new Date(now.getTime() - days * 86_400_000)),
  }));
}

describe('selectExpired', () => {
  const now = at('2026-11-18T03:00:00Z');

  it('selects only backups older than the window', () => {
    const all = make('db', [0, 1, 34, 35, 36, 60], now);
    const expired = selectExpired(all, { target: 'db', maxAgeDays: 35, minKeep: 1 }, now);
    expect(expired.map((e) => e.key).sort()).toEqual(
      make('db', [36, 60], now)
        .map((e) => e.key)
        .sort(),
    );
  });

  it('keeps the newest backups even when they are all too old, so a long outage never empties the bucket', () => {
    const all = make('db', [50, 60, 70, 80], now);
    const expired = selectExpired(all, { target: 'db', maxAgeDays: 35, minKeep: 3 }, now);
    expect(expired).toHaveLength(1);
    expect(expired[0]!.key).toBe(make('db', [80], now)[0]!.key);
  });

  it('never touches the other target or foreign objects', () => {
    const all = [...make('db', [100], now), ...make('keys', [100], now), { key: 'db/notes.txt' }];
    const expired = selectExpired(all, { target: 'keys', maxAgeDays: 14, minKeep: 0 }, now);
    expect(expired.map((e) => e.key)).toEqual(make('keys', [100], now).map((e) => e.key));
  });

  it('applies the shorter window of the keys database', () => {
    const all = make('keys', [1, 13, 15, 20], now);
    const expired = selectExpired(all, { target: 'keys', maxAgeDays: 14, minKeep: 2 }, now);
    expect(expired).toHaveLength(2);
  });

  it('is stable: running it again on what is left selects nothing', () => {
    const all = make('db', [0, 10, 40, 41], now);
    const policy = { target: 'db' as const, maxAgeDays: 35, minKeep: 1 };
    const first = selectExpired(all, policy, now);
    const left = all.filter((b) => !first.some((e) => e.key === b.key));
    expect(selectExpired(left, policy, now)).toEqual([]);
  });

  it('rejects nonsense windows', () => {
    expect(() => selectExpired([], { target: 'db', maxAgeDays: 0, minKeep: 1 }, now)).toThrow();
    expect(() => selectExpired([], { target: 'db', maxAgeDays: 5, minKeep: -1 }, now)).toThrow();
  });
});

describe('selectExpiredGfs: 14 daily plus 8 weekly', () => {
  const now = at('2026-11-18T03:00:00Z');
  const nightly = (target: 'db' | 'keys', count: number) =>
    make(
      target,
      Array.from({ length: count }, (_, i) => i),
      now,
    );
  const kept = (all: StoredBackup[], expired: StoredBackup[]) =>
    all.filter((b) => !expired.some((e) => e.key === b.key));

  it('keeps the newest backup of each of the last 14 days and one per week before that, 8 weeks', () => {
    const all = nightly('db', 120);
    const expired = selectExpiredGfs(all, { target: 'db', daily: 14, weekly: 8 }, now);
    const left = kept(all, expired);
    expect(left).toHaveLength(14 + 8);
    const ageDays = (b: StoredBackup) =>
      Math.round((now.getTime() - parseBackupKey(b.key)!.takenAt.getTime()) / 86_400_000);
    const ages = left.map(ageDays);
    // The 14 newest nights are all there.
    for (let d = 0; d < 14; d++) expect(ages).toContain(d);
    // Older ones are one per week, so no two share a week.
    const weeks = left
      .filter((b) => ageDays(b) >= 14)
      .map((b) => {
        const t = parseBackupKey(b.key)!.takenAt;
        return Math.floor((t.getTime() / 86_400_000 + 3) / 7);
      });
    expect(new Set(weeks).size).toBe(weeks.length);
    expect(weeks).toHaveLength(8);
  });

  it('keeps everything while there are fewer backups than slots', () => {
    const all = nightly('db', 10);
    expect(selectExpiredGfs(all, { target: 'db', daily: 14, weekly: 8 }, now)).toEqual([]);
  });

  it('counts days that have backups, so a long outage does not erode the good copies', () => {
    const all = make('db', [0, 1, 2, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72], now);
    const expired = selectExpiredGfs(all, { target: 'db', daily: 14, weekly: 0 }, now);
    expect(kept(all, expired)).toHaveLength(14);
    expect(kept(all, expired).map((b) => b.key)).toContain(make('db', [0], now)[0]!.key);
  });

  it('keeps only the newest backup of a day that has several', () => {
    const a = { key: backupKey('db', at('2026-11-18T01:00:00Z')) };
    const b = { key: backupKey('db', at('2026-11-18T02:30:00Z')) };
    const expired = selectExpiredGfs([a, b], { target: 'db', daily: 14, weekly: 0 }, now);
    expect(expired).toEqual([a]);
  });

  it('caps the age for the keys database even when slots are free', () => {
    const all = nightly('keys', 20);
    const expired = selectExpiredGfs(
      all,
      { target: 'keys', daily: 14, weekly: 0, maxAgeDays: 14 },
      now,
    );
    const left = kept(all, expired);
    expect(left).toHaveLength(14);
    for (const b of left) {
      const age = now.getTime() - parseBackupKey(b.key)!.takenAt.getTime();
      expect(age).toBeLessThanOrEqual(14 * 86_400_000);
    }
  });

  it('still keeps the single newest backup when everything is past the age cap', () => {
    const all = make('keys', [30, 40], now);
    const expired = selectExpiredGfs(
      all,
      { target: 'keys', daily: 14, weekly: 0, maxAgeDays: 14 },
      now,
    );
    expect(kept(all, expired)).toEqual(make('keys', [30], now));
  });

  it('never touches the other target or foreign objects, and is stable', () => {
    const all = [...nightly('db', 40), ...nightly('keys', 40), { key: 'db/notes.txt' }];
    const policy = { target: 'db' as const, daily: 14, weekly: 8 };
    const first = selectExpiredGfs(all, policy, now);
    expect(first.every((e) => e.key.startsWith('db/ad-'))).toBe(true);
    expect(selectExpiredGfs(kept(all, first), policy, now)).toEqual([]);
  });

  it('rejects nonsense counts', () => {
    expect(() => selectExpiredGfs([], { target: 'db', daily: 0, weekly: 8 }, now)).toThrow();
    expect(() => selectExpiredGfs([], { target: 'db', daily: 14, weekly: -1 }, now)).toThrow();
  });
});
