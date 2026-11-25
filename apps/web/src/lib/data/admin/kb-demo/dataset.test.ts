import { describe, expect, it } from 'vitest';
import { checkDemoDataset, DEMO_DATASET, DEMO_NOW_ISO } from './dataset';

describe('demo dataset is clearly fake', () => {
  it('has no problems', () => {
    expect(checkDemoDataset(DEMO_DATASET)).toEqual([]);
  });

  it('pins the clock to a Lagos morning in the past', () => {
    expect(new Date(DEMO_NOW_ISO).toISOString()).toBe(DEMO_NOW_ISO);
    expect(DEMO_NOW_ISO < '2026-11-25').toBe(true);
  });

  it('has a user for each staff role and uses only reserved example domains', () => {
    expect(DEMO_DATASET.staff.map((s) => s.role).sort()).toEqual([
      'admin',
      'editor',
      'super_admin',
    ]);
    for (const e of DEMO_DATASET.emails()) expect(e).toMatch(/@example\.(com|net|org|test)$/);
  });

  it('marks every sponsor and donation as test', () => {
    for (const s of DEMO_DATASET.sponsors) expect(s.name).toMatch(/\(test\)$/);
    for (const d of DEMO_DATASET.donations) {
      expect(d.test).toBe(true);
      expect(d.donor).toMatch(/\(test\)$/);
    }
  });

  it('catches real looking data', () => {
    const bad = {
      ...DEMO_DATASET,
      sponsors: [
        { ...DEMO_DATASET.sponsors[0]!, contactEmail: 'ceo@realcompany.com', name: 'Real Co' },
      ],
      donations: [
        {
          ...DEMO_DATASET.donations[0]!,
          test: false,
          donor: 'Real Person',
          note: 'call 0803 123 4567',
        },
      ],
    };
    const problems = checkDemoDataset(bad);
    expect(problems.join('\n')).toMatch(/realcompany\.com/);
    expect(problems.join('\n')).toMatch(/Real Co/);
    expect(problems.join('\n')).toMatch(/not marked as test/);
    expect(problems.join('\n')).toMatch(/phone/i);
  });

  it('covers every video status once and a series that uses Part and Lesson', () => {
    const covered = new Set(DEMO_DATASET.videoStatusExamples.map((v) => v.status));
    expect([...covered].sort()).toEqual(
      [
        'draft',
        'failed',
        'needs_captions',
        'processing',
        'published',
        'ready',
        'scheduled',
        'uploading',
      ].sort(),
    );
    expect(DEMO_DATASET.series.some((s) => s.labels?.preset === 'part_lesson')).toBe(true);
  });
});
