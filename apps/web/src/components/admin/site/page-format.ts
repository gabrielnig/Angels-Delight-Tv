/**
 * Toolbar edits for the page editor, as pure functions over the text and the selection, so they can be
 * tested without a browser. The result is always run through the server side sanitiser on save.
 */

export interface Edit {
  text: string;
  /** Selection to restore after the edit. */
  start: number;
  end: number;
}

export type Format = 'bold' | 'italic' | 'h2' | 'bullets';

const WRAP: Record<'bold' | 'italic' | 'h2', [string, string]> = {
  bold: ['<strong>', '</strong>'],
  italic: ['<em>', '</em>'],
  h2: ['<h2>', '</h2>'],
};

function wrap(
  text: string,
  start: number,
  end: number,
  open: string,
  close: string,
  fallback: string,
): Edit {
  const selected = text.slice(start, end) || fallback;
  const next = text.slice(0, start) + open + selected + close + text.slice(end);
  return { text: next, start: start + open.length, end: start + open.length + selected.length };
}

export function applyFormat(text: string, start: number, end: number, format: Format): Edit {
  if (format === 'bullets') {
    const selected = text.slice(start, end) || 'List item';
    const items = selected
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<li>${line}</li>`);
    const block = `<ul>${items.join('')}</ul>`;
    return {
      text: text.slice(0, start) + block + text.slice(end),
      start,
      end: start + block.length,
    };
  }
  const [open, close] = WRAP[format];
  return wrap(text, start, end, open, close, format === 'h2' ? 'Heading' : 'text');
}

/** Only addresses the sanitiser would keep. Returns null for anything else. */
export function cleanLinkAddress(raw: string): string | null {
  const value = raw.trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(value)) return value;
  if (/^http:\/\/[^\s"'<>]+$/i.test(value)) return value;
  if (/^mailto:[^\s"'<>]+@[^\s"'<>]+$/i.test(value)) return value;
  if (/^\/[A-Za-z0-9._~\-/]*$/.test(value) && !value.startsWith('//')) return value;
  return null;
}

export function applyLink(text: string, start: number, end: number, address: string): Edit | null {
  const href = cleanLinkAddress(address);
  if (href === null) return null;
  return wrap(text, start, end, `<a href="${href}">`, '</a>', href);
}
