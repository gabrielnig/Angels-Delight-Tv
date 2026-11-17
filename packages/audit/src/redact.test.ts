import { describe, expect, it } from 'vitest';
import { diffChanges, redact } from './redact';

describe('redact', () => {
  it('replaces secret looking fields at any depth and keeps the rest', () => {
    const out = redact({
      title: 'Plants',
      password: 'hunter2',
      nested: { apiKey: 'abc', token: 't', note: 'ok' },
      list: [{ secret: 's', name: 'n' }],
    });
    expect(out).toEqual({
      title: 'Plants',
      password: '[redacted]',
      nested: { apiKey: '[redacted]', token: '[redacted]', note: 'ok' },
      list: [{ secret: '[redacted]', name: 'n' }],
    });
  });

  it('masks email addresses inside strings', () => {
    expect(redact({ note: 'sent to a.b@example.com today' })).toEqual({
      note: 'sent to [email] today',
    });
  });

  it('bounds long strings, deep trees and long arrays', () => {
    const out = redact({
      text: 'x'.repeat(2000),
      list: Array.from({ length: 200 }, (_, i) => i),
    }) as {
      text: string;
      list: unknown[];
    };
    expect(out.text.length).toBeLessThanOrEqual(501);
    expect(out.list).toHaveLength(50);
    let deep: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 12; i += 1) deep = { child: deep };
    expect(JSON.stringify(redact(deep))).toContain('[depth]');
  });

  it('handles cycles, dates and bigint without throwing', () => {
    const a: Record<string, unknown> = { when: new Date('2026-01-01T00:00:00Z'), big: 10n };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
    expect((redact(a) as Record<string, unknown>).when).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('diffChanges', () => {
  it('keeps only fields that changed, on both sides', () => {
    expect(
      diffChanges({ title: 'A', tags: ['x'], same: 1 }, { title: 'B', tags: ['x'], same: 1 }),
    ).toEqual({
      before: { title: 'A' },
      after: { title: 'B' },
    });
  });
  it('shows added and removed fields', () => {
    expect(diffChanges({ a: 1 }, { b: 2 })).toEqual({ before: { a: 1 }, after: { b: 2 } });
  });
  it('redacts secrets in the diff', () => {
    expect(diffChanges({ apiKey: 'old' }, { apiKey: 'new' })).toEqual({
      before: { apiKey: '[redacted]' },
      after: { apiKey: '[redacted]' },
    });
  });
  it('handles a missing side for creates and deletes', () => {
    expect(diffChanges(null, { title: 'New' })).toEqual({ before: {}, after: { title: 'New' } });
    expect(diffChanges({ title: 'Old' }, null)).toEqual({ before: { title: 'Old' }, after: {} });
  });
});
