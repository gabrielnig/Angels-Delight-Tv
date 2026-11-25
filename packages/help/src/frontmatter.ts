export type FrontValue = string | number | boolean | FrontValue[] | { [key: string]: FrontValue };

/**
 * Reads the front matter block of a help file. This is a strict subset of YAML, so no library is needed and a
 * typo fails loudly: `key: value` pairs, inline lists `[a, b]`, block lists with `- item`, one level of nested
 * map, quoted strings, numbers and true or false. Lines that start with # are comments.
 */
export function parseFrontMatter(source: string): {
  data: Record<string, FrontValue>;
  body: string;
} {
  const text = source.replace(/^\u{FEFF}/u, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---')
    throw new Error('Missing front matter: the file must start with a --- line.');
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end < 0) throw new Error('The front matter block is not closed with a --- line.');

  const data: Record<string, FrontValue> = {};
  let i = 1;
  const fail = (n: number, why: string): never => {
    throw new Error(`Front matter line ${n + 1}: ${why}`);
  };
  while (i < end) {
    const raw = lines[i] ?? '';
    if (!raw.trim() || raw.trim().startsWith('#')) {
      i += 1;
      continue;
    }
    if (/^\s/.test(raw)) fail(i, 'unexpected indent');
    const m = /^([A-Za-z][A-Za-z0-9_]*):(?:\s+(.*))?$/.exec(raw.trimEnd());
    if (!m) return fail(i, `cannot read "${raw.trim()}"`);
    const key = m[1] as string;
    const rest = (m[2] ?? '').trim();
    if (rest) {
      data[key] = scalarOrList(rest, i, fail);
      i += 1;
      continue;
    }
    // A block: either a list of "- item" lines or a map of indented "key: value" lines.
    const items: string[] = [];
    const map: Record<string, FrontValue> = {};
    let kind: 'list' | 'map' | null = null;
    let j = i + 1;
    while (j < end) {
      const line = lines[j] ?? '';
      if (!line.trim() || line.trim().startsWith('#')) {
        j += 1;
        continue;
      }
      if (!/^\s+/.test(line)) break;
      const t = line.trim();
      if (t.startsWith('- ')) {
        if (kind === 'map') fail(j, 'cannot mix a list and a map');
        kind = 'list';
        items.push(t.slice(2).trim());
      } else {
        if (kind === 'list') fail(j, 'cannot mix a list and a map');
        kind = 'map';
        const mm = /^([A-Za-z][A-Za-z0-9_]*):\s+(.*)$/.exec(t);
        if (!mm) return fail(j, `cannot read "${t}"`);
        map[mm[1] as string] = scalarOrList(mm[2] as string, j, fail);
      }
      j += 1;
    }
    data[key] = kind === 'list' ? items.map((x) => scalar(x)) : kind === 'map' ? map : [];
    i = j;
  }
  return { data, body: lines.slice(end + 1).join('\n') };
}

function scalar(raw: string): string | number | boolean {
  const t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function scalarOrList(
  raw: string,
  line: number,
  fail: (n: number, why: string) => never,
): FrontValue {
  if (raw.startsWith('[')) {
    if (!raw.endsWith(']')) fail(line, 'a list must end with ]');
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    const parts: string[] = [];
    let cur = '';
    let quote: string | null = null;
    for (const ch of inner) {
      if (quote) {
        cur += ch;
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        cur += ch;
      } else if (ch === ',') {
        parts.push(cur);
        cur = '';
      } else cur += ch;
    }
    parts.push(cur);
    return parts.map((p) => scalar(p));
  }
  return scalar(raw);
}
