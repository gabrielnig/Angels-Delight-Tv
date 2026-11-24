import { describe, expect, it } from 'vitest';
import { exportCsv, exportJson } from './export';
import { parseCsv } from './csv';
import { hashText } from './status';

const english = { 'nav.home': 'Home', 'player.count': { one: '{count} video', other: '{count} videos' } } as never;
const row = (key: string, status: 'draft' | 'approved', text: string | Record<string, string>) => ({
  key, status, text: text as never, sourceHash: null, updatedAt: new Date(0),
});

describe('export', () => {
  it('contains every English key with status', () => {
    const rows = parseCsv(exportCsv({ locale: 'yo', english, baseline: {}, rows: [row('nav.home', 'draft', 'Ilé')] }));
    expect(rows[0]).toEqual(['key', 'area', 'english', 'translation', 'status', 'note']);
    expect(rows.map((r) => r[0])).toEqual(['key', 'nav.home', 'player.count']);
    expect(rows[1]).toEqual(['nav.home', 'nav', 'Home', 'Ilé', 'draft', '']);
  });
  it('export of an empty locale has blank translations and status missing', () => {
    const rows = parseCsv(exportCsv({ locale: 'ig', english, baseline: {}, rows: [] }));
    expect(rows[1]![3]).toBe('');
    expect(rows[1]![4]).toBe('missing');
    expect(rows[2]![2]).toBe('{"one":"{count} video","other":"{count} videos"}');
  });
  it('JSON export is the effective catalog ready to commit', () => {
    const json = JSON.parse(
      exportJson({
        locale: 'yo',
        english,
        baseline: { 'nav.home': 'Ilé baseline' },
        rows: [row('player.count', 'approved', { other: '{count} fídíò' }), row('nav.home', 'draft', 'Ilé draft')],
      }),
    );
    expect(json).toEqual({ 'nav.home': 'Ilé baseline', 'player.count': { other: '{count} fídíò' } });
  });
  it('uses the hash column of nothing: stale rows are flagged', () => {
    const rows = parseCsv(exportCsv({ locale: 'yo', english, baseline: {}, rows: [{ ...row('nav.home', 'approved', 'Ilé'), sourceHash: hashText('Old') }] }));
    expect(rows[1]![4]).toBe('stale');
  });
});
