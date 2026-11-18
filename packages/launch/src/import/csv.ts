export const BOM = String.fromCharCode(0xfeff);

export type CsvResult = { ok: true; rows: Record<string, string>[] } | { ok: false; error: string };

/** RFC 4180 style: quoted fields, doubled quotes, commas and line breaks inside quotes, CRLF or LF, optional BOM. */
export function parseCsv(input: string): CsvResult {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let sawAny = false;

  const endField = () => {
    record.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    if (!(record.length === 1 && record[0] === '')) records.push(record);
    record = [];
    sawAny = false;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field === '') {
      inQuotes = true;
      sawAny = true;
    } else if (char === ',') {
      endField();
      sawAny = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRecord();
    } else {
      field += char;
      sawAny = true;
    }
  }
  if (inQuotes) return { ok: false, error: 'A quoted field is never closed' };
  if (sawAny || field !== '' || record.length > 0) endRecord();

  const [header, ...body] = records;
  if (!header) return { ok: true, rows: [] };
  const names = header.map((name) => name.trim());
  const rows: Record<string, string>[] = [];
  for (const [index, values] of body.entries()) {
    if (values.length !== names.length) {
      return {
        ok: false,
        error: `Line ${index + 2} has ${values.length} fields but the header has ${names.length}`,
      };
    }
    rows.push(Object.fromEntries(names.map((name, column) => [name, values[column]!])));
  }
  return { ok: true, rows };
}
