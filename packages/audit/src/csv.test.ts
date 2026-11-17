import { describe, expect, it } from 'vitest';
import { auditCsv, csvCell } from './csv';

describe('csvCell', () => {
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('\tx')).toBe("'\tx");
  });
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('renders null as empty', () => {
    expect(csvCell(null)).toBe('');
  });
});

describe('auditCsv', () => {
  it('returns headers only for no rows', () => {
    expect(auditCsv([]).trim()).toBe(
      'id,occurred_at,actor_account_id,actor_role,action,outcome,target_type,target_id,ip,request_id,summary',
    );
  });
  it('writes one line per entry with the summary', () => {
    const csv = auditCsv([
      {
        id: 5,
        occurredAt: new Date('2026-03-01T10:00:00Z'),
        actorAccountId: 'a1',
        actorRole: 'admin',
        action: 'video.publish',
        outcome: 'success',
        targetType: 'video',
        targetId: '=evil',
        ipTrunc: '203.0.113.0/24',
        requestId: 'r',
        metadata: { summary: 'Published it' },
      },
    ]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("'=evil");
    expect(lines[1]).toContain('2026-03-01T10:00:00.000Z');
    expect(lines[1]).toContain('Published it');
  });
});
