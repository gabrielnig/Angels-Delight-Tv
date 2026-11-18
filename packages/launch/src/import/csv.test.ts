import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('reads a header row and records', () => {
    expect(parseCsv('a,b\n1,2\n3,4\n')).toEqual({
      ok: true,
      rows: [
        { a: '1', b: '2' },
        { a: '3', b: '4' },
      ],
    });
  });

  it('handles quotes, commas, doubled quotes and newlines inside a field', () => {
    const text = 'title,description\r\n"Hello, world","She said ""hi""\nand left"\r\n';
    expect(parseCsv(text)).toEqual({
      ok: true,
      rows: [{ title: 'Hello, world', description: 'She said "hi"\nand left' }],
    });
  });

  it('strips a byte order mark and skips blank lines', () => {
    expect(parseCsv('﻿a\n\n1\n\n')).toEqual({ ok: true, rows: [{ a: '1' }] });
  });

  it('keeps empty fields as empty strings', () => {
    expect(parseCsv('a,b,c\n1,,3\n')).toEqual({ ok: true, rows: [{ a: '1', b: '', c: '3' }] });
  });

  it('reports a row with the wrong number of fields and an unclosed quote', () => {
    expect(parseCsv('a,b\n1\n')).toMatchObject({ ok: false });
    expect(parseCsv('a,b\n"1,2\n')).toMatchObject({ ok: false });
  });
});
