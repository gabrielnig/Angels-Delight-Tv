import { describe, expect, it } from 'vitest';
import { auditFiltersFromParams } from './params';

describe('auditFiltersFromParams', () => {
  it('turns the stored filters into query filters, with the day range made inclusive of the end day', () => {
    const f = auditFiltersFromParams(
      {
        action: 'video.',
        actor: '0192f0a0-0000-7000-8000-000000000001',
        target: 'v1',
        outcome: 'denied',
        from: '2026-06-01',
        to: '2026-06-02',
      },
      'all',
    );
    expect(f).toMatchObject({
      action: 'video.',
      actorAccountId: '0192f0a0-0000-7000-8000-000000000001',
      targetId: 'v1',
      outcome: 'denied',
      scope: 'all',
    });
    expect(f.from?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(f.to?.toISOString()).toBe('2026-06-03T00:00:00.000Z');
  });

  it('keeps the scope it is given and ignores anything that is not a filter', () => {
    const f = auditFiltersFromParams({ scope: 'all', cursor: '5', junk: 'x' }, 'content');
    expect(f.scope).toBe('content');
    expect(Object.keys(f).sort()).toEqual(['scope']);
  });

  it('drops an actor that is not an id and an outcome it does not know', () => {
    const f = auditFiltersFromParams({ actor: "x' OR 1=1", outcome: 'maybe' }, 'all');
    expect(f.actorAccountId).toBeUndefined();
    expect(f.outcome).toBeUndefined();
  });

  it('drops a day that is not a day', () => {
    const f = auditFiltersFromParams({ from: 'yesterday', to: '2026-13-45' }, 'all');
    expect(f.from).toBeUndefined();
    expect(f.to).toBeUndefined();
  });
});
