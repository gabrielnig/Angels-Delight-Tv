import { describe, expect, it } from 'vitest';
import {
  AUDIT_CSV_HEADER,
  TITLE_DAILY_CSV_HEADER,
  auditCsv,
  auditCsvLine,
  csvCell,
  titleDailyCsvLine,
} from './csv';

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

describe('streaming pieces of the audit CSV', () => {
  const record = {
    id: 7,
    occurredAt: new Date('2026-06-01T10:00:00Z'),
    actorAccountId: null,
    actorRole: 'admin',
    action: 'video.edit',
    outcome: 'success' as const,
    targetType: 'video',
    targetId: 'v1',
    ipTrunc: null,
    requestId: null,
    metadata: { summary: '=cmd()' },
  };

  it('writes the header and each row separately, so a file can be built without holding every row', () => {
    const whole = auditCsv([record, { ...record, id: 8 }]);
    const parts = `${AUDIT_CSV_HEADER}\n${auditCsvLine(record)}\n${auditCsvLine({ ...record, id: 8 })}\n`;
    expect(parts).toBe(whole);
  });

  it('still neutralises a formula in a streamed row', () => {
    expect(auditCsvLine(record)).toContain("'=cmd()");
  });
});

describe('title daily CSV pieces (M19-S05)', () => {
  const row = {
    day: '2026-06-01',
    videoId: 'v1',
    title: '=Fractions, part 1',
    archived: false,
    views: 3,
    watchMs: 90_500,
    completions: 1,
  };

  it('writes the header and a row with seconds, not milliseconds', () => {
    expect(TITLE_DAILY_CSV_HEADER).toBe(
      'day,video_id,title,archived,views,watch_seconds,completions,likes,loves,not_for_me,positive_share_percent',
    );
    expect(titleDailyCsvLine({ ...row, title: 'Fractions' })).toBe(
      '2026-06-01,v1,Fractions,no,3,91,1,,,,',
    );
  });

  it('writes rating counts and the share, and leaves the share blank under ten ratings', () => {
    expect(
      titleDailyCsvLine({ ...row, title: 'Fractions', likes: 6, loves: 2, dislikes: 2, positiveShare: 80 }),
    ).toBe('2026-06-01,v1,Fractions,no,3,91,1,6,2,2,80');
    expect(
      titleDailyCsvLine({ ...row, title: 'Fractions', likes: 1, loves: 0, dislikes: 0, positiveShare: null }),
    ).toBe('2026-06-01,v1,Fractions,no,3,91,1,1,0,0,');
  });

  it('neutralises a formula and quotes a comma in the title', () => {
    expect(titleDailyCsvLine(row)).toBe(`2026-06-01,v1,"'=Fractions, part 1",no,3,91,1,,,,`);
  });
});
