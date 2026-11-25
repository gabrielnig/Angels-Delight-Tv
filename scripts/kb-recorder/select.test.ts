import { describe, expect, it } from 'vitest';
import type { Episode } from './episode';
import { affectedEpisodes, parseEpisodeList, pathOf, selectEpisodes, PATHS } from './select';

const run = async () => {};
const ep = (id: string, extra: Partial<Episode> = {}): Episode => ({
  id,
  title: id,
  role: 'editor',
  steps: [{ caption: 'Click.', run }],
  ...extra,
});

const episodes = [
  ep('S02', { dependsOn: ['apps/web/src/app/admin/login'] }),
  ep('D02', {
    dependsOn: ['apps/web/src/app/admin/videos/upload', 'apps/web/src/components/admin/nav.ts'],
  }),
  ep('D10', { dependsOn: ['apps/web/src/app/admin/videos'] }),
  ep('W01', { dependsOn: ['apps/web/src/app/admin/series'] }),
  ep('H01-sign-in'),
];

describe('paths', () => {
  it('maps the letter of an article id to its learning path', () => {
    expect(pathOf(ep('S02'))).toBe('start');
    expect(pathOf(ep('D10'))).toBe('daily');
    expect(pathOf(ep('W01'))).toBe('weekly');
    expect(pathOf(ep('C07'))).toBe('setup');
    expect(pathOf(ep('M03'))).toBe('money');
    expect(pathOf(ep('K04'))).toBe('safety');
    expect(pathOf(ep('T01'))).toBe('troubleshooting');
    expect(pathOf(ep('H01-sign-in'))).toBeNull();
    expect(pathOf(ep('H01-sign-in', { path: 'daily' }))).toBe('daily');
    expect(Object.keys(PATHS)).toEqual([
      'start',
      'daily',
      'weekly',
      'setup',
      'money',
      'safety',
      'troubleshooting',
    ]);
  });
});

describe('parseEpisodeList', () => {
  it('splits on commas and trims', () => {
    expect(parseEpisodeList(' D02, D10 ')).toEqual(['D02', 'D10']);
  });
});

describe('affectedEpisodes (--changed)', () => {
  it('picks episodes whose dependsOn prefix matches a changed file', () => {
    const ids = (files: string[]) => affectedEpisodes(episodes, files).map((e) => e.id);
    expect(ids(['apps/web/src/app/admin/videos/upload/page.tsx'])).toEqual(['D02', 'D10']);
    expect(ids(['apps/web/src/app/admin/series/[id]/page.tsx'])).toEqual(['W01']);
    expect(ids(['README.md'])).toEqual([]);
  });

  it('includes an episode through a shared component it lists', () => {
    expect(
      affectedEpisodes(episodes, ['apps/web/src/components/admin/nav.ts']).map((e) => e.id),
    ).toEqual(['D02']);
  });

  it('does not match a longer sibling folder name', () => {
    expect(
      affectedEpisodes(episodes, ['apps/web/src/app/admin/videos-archive/x.ts']).map((e) => e.id),
    ).toEqual([]);
  });

  it('picks an episode when its own file changed', () => {
    expect(
      affectedEpisodes(episodes, ['scripts/kb-recorder/episodes/W01.ts']).map((e) => e.id),
    ).toEqual(['W01']);
  });

  it('runs everything when the harness itself changed', () => {
    expect(affectedEpisodes(episodes, ['scripts/kb-recorder/helpers.ts']).map((e) => e.id)).toEqual(
      episodes.map((e) => e.id),
    );
  });

  it('does not run everything for a test file of the harness', () => {
    expect(affectedEpisodes(episodes, ['scripts/kb-recorder/helpers.test.ts'])).toEqual([]);
  });
});

describe('selectEpisodes', () => {
  it('picks by id, in the order asked', () => {
    expect(selectEpisodes(episodes, { episode: 'D10,S02' }).map((e) => e.id)).toEqual([
      'D10',
      'S02',
    ]);
  });
  it('names the unknown id and lists the known ones', () => {
    expect(() => selectEpisodes(episodes, { episode: 'X99' })).toThrow(
      /X99.*S02, D02, D10, W01, H01-sign-in/,
    );
  });
  it('picks a path', () => {
    expect(selectEpisodes(episodes, { path: 'daily' }).map((e) => e.id)).toEqual(['D02', 'D10']);
    expect(() => selectEpisodes(episodes, { path: 'nope' })).toThrow(/start, daily/);
  });
  it('picks all', () => {
    expect(selectEpisodes(episodes, { all: true })).toHaveLength(5);
  });
  it('picks the changed ones from the files given', () => {
    expect(
      selectEpisodes(episodes, { changed: true }, ['apps/web/src/app/admin/series/page.tsx']).map(
        (e) => e.id,
      ),
    ).toEqual(['W01']);
  });
  it('needs exactly one way to choose', () => {
    expect(() => selectEpisodes(episodes, {})).toThrow(/--episode, --path, --changed or --all/);
    expect(() => selectEpisodes(episodes, { all: true, path: 'daily' })).toThrow(/only one/);
  });
});
