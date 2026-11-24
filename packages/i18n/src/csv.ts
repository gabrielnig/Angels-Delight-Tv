/** Minimal CSV for translation files. Writes a UTF-8 BOM so Excel keeps the diacritics, reads either form, NFC everywhere. */
const BOM = '﻿';

export function toCsv(rows: readonly (readonly string[])[]): string {
  const cell = (value: string) => {
    const v = value.normalize('NFC');
    return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return BOM + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function parseCsv(input: string): string[][] {
  const text = (input.startsWith(BOM) ? input.slice(1) : input).normalize('NFC');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
