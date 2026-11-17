/**
 * Allow list HTML sanitiser for admin edited pages (M26-S02 AC2). No dependency: it tokenises the input,
 * keeps a small set of tags with no attributes (links get a checked href), drops everything else and
 * escapes all text. The output is rebuilt from tokens, never copied from the input.
 */

const ALLOWED = new Set([
  'p',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'a',
  'strong',
  'em',
  'br',
  'blockquote',
  'hr',
]);
const RENAMED: Record<string, string> = { b: 'strong', i: 'em' };
const VOID = new Set(['br', 'hr']);
/** Elements whose content is code or embedded media, so the content is removed with the tag. */
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'noscript',
  'textarea',
  'title',
  'head',
  'select',
  'option',
  'button',
  'form',
  'frameset',
  'audio',
  'video',
]);
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

const TOKEN = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>|<|[^<]+/g;

const NAMED_DECODE: Record<string, string> = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  sol: '/',
  lpar: '(',
  rpar: ')',
};

function escapeText(text: string): string {
  return text
    .replace(/&(?!(?:#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);?/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return NAMED_DECODE[body.toLowerCase()] ?? match;
  });
}

const ch = (...codes: number[]) => String.fromCharCode(...codes);
/** Control, space, zero width and line separator characters that browsers ignore inside a scheme. */
const INVISIBLE = new RegExp(
  `[${ch(0)}-${ch(32)}${ch(127)}-${ch(159)}${ch(0x200b)}-${ch(0x200f)}${ch(0x2028, 0x2029, 0xfeff)}]`,
  'g',
);

function safeHref(raw: string): string | null {
  const decoded = decodeEntities(raw).replace(INVISIBLE, '');
  if (decoded === '') return null;
  if (decoded.startsWith('//')) return null;
  if (decoded.startsWith('/') || decoded.startsWith('#') || decoded.startsWith('?')) return decoded;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(decoded);
  if (!scheme)
    return /^[A-Za-z0-9._~%-]+(\/|$)/.test(decoded) && !decoded.includes(':') ? decoded : null;
  return SAFE_SCHEMES.has(scheme[1]!.toLowerCase()) ? decoded : null;
}

function readHref(attributes: string): string | null {
  const match = /(?:^|[\s/])href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attributes);
  if (!match) return null;
  return safeHref(match[1] ?? match[2] ?? match[3] ?? '');
}

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string' || input === '') return '';
  let output = '';
  const open: string[] = [];
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN.exec(input)) !== null) {
    const token = match[0];
    const rawName = match[1];
    if (token.startsWith('<!--')) continue;
    if (rawName === undefined) {
      output += token === '<' ? '&lt;' : escapeText(token);
      continue;
    }
    const name = rawName.toLowerCase();
    const closing = token.startsWith('</');

    if (!closing && DROP_WITH_CONTENT.has(name)) {
      const rest = input.slice(TOKEN.lastIndex);
      const end = new RegExp(`</${name}\\s*>`, 'i').exec(rest);
      TOKEN.lastIndex = end ? TOKEN.lastIndex + end.index + end[0].length : input.length;
      continue;
    }

    const tag = RENAMED[name] ?? name;
    if (!ALLOWED.has(tag)) continue;

    if (closing) {
      const index = open.lastIndexOf(tag);
      if (index < 0) continue;
      while (open.length > index) output += `</${open.pop()}>`;
      continue;
    }

    if (tag === 'a') {
      const href = readHref(match[2] ?? '');
      output +=
        href === null
          ? '<a rel="noopener noreferrer">'
          : `<a href="${escapeAttribute(href)}" rel="noopener noreferrer">`;
      open.push('a');
    } else if (VOID.has(tag)) {
      output += `<${tag}>`;
    } else {
      output += `<${tag}>`;
      open.push(tag);
    }
  }
  while (open.length > 0) output += `</${open.pop()}>`;
  return output;
}

/** Visible text of an HTML fragment, with entities decoded. For placeholder checks and previews. */
export function stripToText(html: string): string {
  const cleaned = sanitizeHtml(html)
    .replace(/<\/(p|h2|h3|h4|li|blockquote)>/g, ' ')
    .replace(/<br>|<hr>/g, ' ')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(cleaned).replace(/\s+/g, ' ').trim();
}

/** True when a page still has no real content: empty, or the launch checklist placeholder text. */
export function isPlaceholderBody(html: string): boolean {
  const text = stripToText(html);
  if (text === '') return true;
  if (/^\[.*\]$/.test(text)) return true;
  if (/^\[?add your\b/i.test(text) && /here/i.test(text)) return true;
  return /^placeholder text$/i.test(text);
}
