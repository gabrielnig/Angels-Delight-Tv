import { describe, expect, it } from 'vitest';
import { validateEpisode } from './episode';
import { listEpisodeIds, loadAllEpisodes } from './registry';

describe('every episode is valid', async () => {
  const episodes = await loadAllEpisodes();

  it('has at least one episode', () => {
    expect(episodes.length).toBeGreaterThan(0);
  });

  it('names every file after its episode id', async () => {
    expect((await listEpisodeIds()).sort()).toEqual(episodes.map((e) => e.id).sort());
  });

  it('has unique ids', () => {
    const ids = episodes.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(episodes.map((e) => [e.id, e] as const))('%s has no problems', (_id, e) => {
    expect(validateEpisode(e)).toEqual([]);
  });
});

describe('validateEpisode', () => {
  const ok = {
    id: 'D02',
    title: 'T',
    role: 'editor' as const,
    steps: [{ caption: 'Click Videos.', run: async () => {} }],
  };
  it('accepts a minimal episode', () => expect(validateEpisode(ok)).toEqual([]));
  it('rejects a bad id, empty title, no steps and unknown role', () => {
    expect(validateEpisode({ ...ok, id: 'bad id' })).toContain(
      'id "bad id" must use letters, numbers and dashes only',
    );
    expect(validateEpisode({ ...ok, title: ' ' })).toContain('title is empty');
    expect(validateEpisode({ ...ok, steps: [] })).toContain('has no steps');
    expect(validateEpisode({ ...ok, role: 'boss' as never })).toContain('unknown role "boss"');
  });
  it('rejects duplicate shot names and empty captions', () => {
    const s = (name: string) => ({
      caption: 'Click.',
      run: async () => {},
      shot: { name, marks: [] },
    });
    expect(validateEpisode({ ...ok, steps: [s('a'), s('a')] })).toContain(
      'shot name "a" is used twice',
    );
    expect(validateEpisode({ ...ok, steps: [{ caption: '', run: async () => {} }] })).toContain(
      'step 1 has no caption',
    );
  });
});
