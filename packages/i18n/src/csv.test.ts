import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';

describe('csv', () => {
  it('writes a UTF-8 BOM', () => {
    expect(toCsv([['a', 'b']]).charCodeAt(0)).toBe(0xfeff);
  });
  it('reads with and without a BOM', () => {
    expect(parseCsv('﻿a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('keeps o with dot below and tone marks unchanged through a round trip', () => {
    const rows = [['key', 'text'], ['a.b', 'Ọ̀rọ̀ ẹ̀kọ́']];
    expect(parseCsv(toCsv(rows))).toEqual(rows.map((r) => r.map((c) => c.normalize('NFC'))));
  });
  it('handles commas, quotes and newlines', () => {
    const rows = [['k', 'He said "hi", then\nleft']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it('normalises decomposed input to NFC', () => {
    expect(parseCsv('ọ')[0]![0]).toBe('ọ');
  });
});
