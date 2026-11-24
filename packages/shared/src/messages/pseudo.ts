/** Dev only pseudo locale for layout and font QA: marks everywhere, about 40 percent longer, placeholders kept. */
import type { MessageText } from './messages';

const MAP: Record<string, string> = { e: 'ẹ', o: 'ọ', i: 'ị', u: 'ụ', s: 'ṣ', a: 'á', E: 'Ẹ', O: 'Ọ', I: 'Ị', U: 'Ụ', S: 'Ṣ' };
const FILLER = ['ẹ', 'ọ́', 'ṣ', 'ị', 'ụ'];

function one(text: string): string {
  const mapped = text
    .split(/(\{\w+\})/)
    .map((part) => (/^\{\w+\}$/.test(part) ? part : [...part].map((c) => MAP[c] ?? c).join('')))
    .join('');
  const pad = Math.max(5, Math.ceil(text.length * 0.4));
  let filler = '';
  for (let i = 0; i < pad; i++) filler += FILLER[i % FILLER.length];
  return `[${mapped} ${filler}]`.normalize('NFC');
}

export function pseudo<T extends MessageText>(text: T): T {
  if (typeof text === 'string') return one(text) as T;
  return Object.fromEntries(Object.entries(text).map(([k, v]) => [k, one(v as string)])) as T;
}
