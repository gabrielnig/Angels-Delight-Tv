import { describe, expect, it } from 'vitest';
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, planImport } from './import';
import { toCsv } from './csv';
import { hashText } from './status';

const english = { 'nav.home': 'Home', 'nav.browse': 'Browse {name}', 'player.count': { one: '{count} video', other: '{count} videos' } } as never;
const header = ['key', 'area', 'english', 'translation', 'status', 'note'];
const csv = (...rows: string[][]) => toCsv([header, ...rows]);
const plan = (text: string, existing: never[] = []) => planImport({ locale: 'yo', english, baseline: {}, existing, csv: text });
const existingRow = (key: string, text: string) => ({ key, text, status: 'approved' as const, sourceHash: hashText((english as Record<string, never>)[key]!), updatedAt: new Date(0) });

describe('planImport', () => {
  it('dry run reports added, changed, unchanged and rejected without writing', () => {
    const p = plan(
      csv(['nav.home', '', '', 'Ilé', '', ''], ['nav.browse', '', '', 'Wá', '', ''], ['nav.nope', '', '', 'x', '', '']),
      [existingRow('nav.browse', 'Wá {name}')] as never,
    );
    expect(p.added.map((r) => r.key)).toEqual(['nav.home']);
    expect(p.rejected.map((r) => r.key).sort()).toEqual(['nav.browse', 'nav.nope']);
  });
  it('reports changed and unchanged rows', () => {
    const existing = [existingRow('nav.home', 'Ilé'), existingRow('nav.browse', 'Wá {name}')] as never;
    const p = plan(csv(['nav.home', '', '', 'Ilé', '', ''], ['nav.browse', '', '', 'Ṣàwárí {name}', '', '']), existing);
    expect(p.unchanged.map((r) => r.key)).toEqual(['nav.home']);
    expect(p.changed.map((r) => r.key)).toEqual(['nav.browse']);
  });
  it('rejected rows carry a reason per row', () => {
    const p = plan(csv(['nav.nope', '', '', 'x', '', ''], ['nav.browse', '', '', 'Wá', '', '']));
    expect(p.rejected).toEqual([
      { row: 2, key: 'nav.nope', reason: 'Unknown key' },
      { row: 3, key: 'nav.browse', reason: expect.stringContaining('placeholder') },
    ]);
  });
  it('imported rows become in_review, never approved', () => {
    const p = plan(csv(['nav.home', '', '', 'Ilé', 'approved', '']));
    expect(p.writes[0]).toMatchObject({ key: 'nav.home', status: 'in_review' });
  });
  it('a row that only changes whitespace is unchanged', () => {
    const p = plan(csv(['nav.home', '', '', '  Ilé  ', '', '']), [existingRow('nav.home', 'Ilé')] as never);
    expect(p.unchanged).toHaveLength(1);
    expect(p.writes).toHaveLength(0);
  });
  it('blank translations are skipped', () => {
    const p = plan(csv(['nav.home', '', '', '', '', '']));
    expect(p.blank).toBe(1);
    expect(p.writes).toHaveLength(0);
  });
  it('plural rows are read as JSON objects', () => {
    const p = plan(csv(['player.count', '', '', '{"other":"{count} fídíò"}', '', '']));
    expect(p.added).toHaveLength(1);
    expect(plan(csv(['player.count', '', '', 'plain', '', ''])).rejected).toHaveLength(1);
  });
  it('more than 5,000 rows or 2 MB is refused', () => {
    expect(IMPORT_MAX_ROWS).toBe(5000);
    expect(IMPORT_MAX_BYTES).toBe(2 * 1024 * 1024);
    const many = csv(...Array.from({ length: 5001 }, () => ['nav.home', '', '', 'x', '', '']));
    expect(() => plan(many)).toThrow(/5,000/);
    expect(() => plan('a'.repeat(2 * 1024 * 1024 + 1))).toThrow(/2 MB/);
  });
  it('a file without a key and translation column is refused', () => {
    expect(() => plan('a,b\n1,2')).toThrow(/key/);
  });
});
