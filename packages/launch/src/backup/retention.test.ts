import { describe, expect, it } from 'vitest';
import { backupKey, parseBackupKey, selectExpired, type StoredBackup } from './retention';

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
