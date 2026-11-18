import { describe, expect, it } from 'vitest';
import { parseManifestText, validateManifest, type RawRow } from './manifest';

const everything = async () => true;

describe('parseManifestText', () => {
  it('reads CSV with flexible header names', () => {
    const result = parseManifestText(
      'File Name,Title,Age Rating,Categories\nintro.mp4,Intro,kids,Science|Maths\n',
      'csv',
    );
    expect(result).toEqual({
      ok: true,
      rows: [
        {
          line: 2,
          values: {
            file: 'intro.mp4',
            title: 'Intro',
            age_rating: 'kids',
            category: 'Science|Maths',
          },
        },
      ],
    });
  });

  it('reads a JSON array and a { videos: [] } wrapper, with list and number values', () => {
    const a = parseManifestText(
      JSON.stringify([{ file: 'a.mp4', category: ['One', 'Two'], season: 2 }]),
      'json',
    );
    expect(a).toMatchObject({ ok: true });
    if (!a.ok) return;
    expect(a.rows[0]!.values).toEqual({ file: 'a.mp4', category: 'One|Two', season: '2' });
    const b = parseManifestText(JSON.stringify({ videos: [{ file: 'b.mp4' }] }), 'json');
    expect(b).toMatchObject({ ok: true });
  });

  it('rejects unknown columns so a typo is not silently ignored', () => {
    const result = parseManifestText('file,titel\na.mp4,x\n', 'csv');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('titel');
  });

  it('rejects broken JSON and a missing file column', () => {
    expect(parseManifestText('{nope', 'json').ok).toBe(false);
    expect(parseManifestText('title\nx\n', 'csv').ok).toBe(false);
  });
});

function raw(values: Record<string, string>, line = 2): RawRow {
  return { line, values };
}

describe('validateManifest', () => {
  it('normalises a full row', async () => {
    const result = await validateManifest(
      [
        raw({
          file: 'ep1.mp4',
          title: '  Episode  One ',
          description: 'About it',
          category: 'Science | Maths;Science',
          series: 'Wonders',
          season: '1',
          episode: '1',
          age_rating: 'Everyone',
          language: 'yo',
          script: 'scripts/ep1.txt',
          poster: 'posters/ep1.jpg',
        }),
      ],
      { exists: everything },
    );
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual({
      line: 2,
      file: 'ep1.mp4',
      title: 'Episode One',
      description: 'About it',
      categories: ['Science', 'Maths'],
      series: 'Wonders',
      season: 1,
      episode: 1,
      suitability: 'everyone',
      language: 'yo',
      script: 'scripts/ep1.txt',
      poster: 'posters/ep1.jpg',
    });
  });

  it('defaults title from the file name, language to en, and age rating to unset', async () => {
    const { rows } = await validateManifest([raw({ file: 'my_first_video.mp4' })], {
      exists: everything,
    });
    expect(rows[0]).toMatchObject({
      title: 'my first video',
      language: 'en',
      suitability: null,
      categories: [],
      series: null,
    });
  });

  it('maps common age rating words', async () => {
    const words: [string, string][] = [
      ['kids', 'kids'],
      ['G', 'everyone'],
      ['all', 'everyone'],
      ['13+', 'older'],
      ['teen', 'older'],
    ];
    for (const [word, expected] of words) {
      const { rows, errors } = await validateManifest([raw({ file: 'a.mp4', age_rating: word })], {
        exists: everything,
      });
      expect(errors).toEqual([]);
      expect(rows[0]!.suitability).toBe(expected);
    }
  });

  it('collects every problem with line numbers before anything is imported', async () => {
    const { errors } = await validateManifest(
      [
        raw({ file: 'a.mp4', age_rating: 'purple' }, 2),
        raw({ file: 'b.exe' }, 3),
        raw({ file: '../escape.mp4' }, 4),
        raw({ file: 'c.mp4', series: 'S' }, 5),
        raw({ file: 'd.mp4', season: '1', episode: '1' }, 6),
        raw({ file: 'e.mp4', language: 'English' }, 7),
        raw({ file: 'f.mp4', title: 'x'.repeat(201) }, 8),
        raw({ file: 'a.mp4' }, 9),
        raw({ file: '' }, 10),
      ],
      { exists: everything },
    );
    const byLine = (line: number) =>
      errors.filter((error) => error.line === line).map((error) => error.field);
    expect(byLine(2)).toContain('age_rating');
    expect(byLine(3)).toContain('file');
    expect(byLine(4)).toContain('file');
    expect(byLine(5)).toContain('season');
    expect(byLine(6)).toContain('series');
    expect(byLine(7)).toContain('language');
    expect(byLine(8)).toContain('title');
    expect(byLine(9)).toContain('file');
    expect(byLine(10)).toContain('file');
  });

  it('flags missing files, scripts and posters', async () => {
    const { errors } = await validateManifest(
      [raw({ file: 'a.mp4', script: 's.txt', poster: 'p.jpg' })],
      { exists: async (path) => path === 'a.mp4' },
    );
    expect(errors.map((error) => error.field).sort()).toEqual(['poster', 'script']);
  });

  it('rejects a poster that is not an image and a script that is not text', async () => {
    const { errors } = await validateManifest(
      [raw({ file: 'a.mp4', script: 's.pdf', poster: 'p.gif' })],
      { exists: everything },
    );
    expect(errors.map((error) => error.field).sort()).toEqual(['poster', 'script']);
  });

  it('rejects two rows claiming the same episode of a series', async () => {
    const row = { series: 'S', season: '1', episode: '2' };
    const { errors } = await validateManifest(
      [raw({ file: 'a.mp4', ...row }, 2), raw({ file: 'b.mp4', ...row }, 3)],
      { exists: everything },
    );
    expect(errors.some((error) => error.line === 3 && error.field === 'episode')).toBe(true);
  });
});
