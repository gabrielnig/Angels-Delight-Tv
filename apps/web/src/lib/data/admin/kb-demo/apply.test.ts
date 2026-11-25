import { describe, expect, it } from 'vitest';
import { seedStore } from '../store';
import { applyDemo } from './apply';
import { DEMO_DATASET, DEMO_NOW_ISO } from './dataset';

const NOW = Date.parse(DEMO_NOW_ISO);
const build = () => applyDemo(seedStore(NOW), DEMO_DATASET, NOW);

describe('applyDemo', () => {
  it('is deterministic: the same clock gives the same state', () => {
    expect(build()).toEqual(build());
  });

  it('leaves one video for every status of the dataset', () => {
    const store = build();
    for (const ex of DEMO_DATASET.videoStatusExamples) {
      const v = store.videos.find((x) => x.id === ex.videoId);
      expect(v, `video ${ex.videoId} for ${ex.status}`).toBeDefined();
    }
  });

  it('adds a series that reads Part and Lesson with two lessons', () => {
    const store = build();
    const s = store.series.find((x) => x.id === 'ser_demo_parts');
    expect(s?.labelOverride?.preset).toBe('part_lesson');
    expect(store.videos.filter((v) => v.seriesId === 'ser_demo_parts').length).toBe(2);
  });

  it('adds sponsors and donations marked as test', () => {
    const store = build() as unknown as {
      sponsors: Array<{ name: string }>;
      donations: Array<{ test: boolean }>;
    };
    expect(store.sponsors.length).toBe(DEMO_DATASET.sponsors.length);
    expect(store.donations.every((d) => d.test)).toBe(true);
  });

  it('renames people so no real looking name shows', () => {
    const store = build();
    expect(store.staff.map((s) => s.name)).toEqual(
      expect.arrayContaining(['Demo Owner', 'Demo Admin', 'Demo Editor']),
    );
    expect(
      store.users.every((u) => u.profiles.every((p) => /^Demo Viewer \d\d/.test(p.name))),
    ).toBe(true);
    expect(store.videos.every((v) => /^Demo /.test(v.uploadedBy))).toBe(true);
  });
});
