/** Translation validation, shared by the editor save and the import (M46). Errors block, warnings do not. */
import { localeInfo } from './locales';
import type { MessageText } from './messages';

export interface ValidateInput {
  /** The message key, when known. Lets key specific rules apply, such as the tab label cap. */
  key?: string;
  locale: string;
  english: MessageText;
  text: MessageText;
}
export interface ValidateResult {
  errors: string[];
  warnings: string[];
  normalized: MessageText;
}

const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
const HTML = /<\/?[a-z!][^>]*>/i;
const MAX_RATIO = 2.5;

/** Tab bar labels are capped so four tabs fit a 320 px phone. Longer text is cut with an ellipsis (S184). */
export const TAB_LABEL_KEYS: readonly string[] = [
  'nav.home',
  'nav.browse',
  'nav.search',
  'nav.myList',
];
export const TAB_LABEL_MAX = 12;
export const TAB_LABEL_WARNING = `is over ${TAB_LABEL_MAX} characters, so the tab bar will cut it with an ellipsis`;

/** Characters as a reader counts them: a letter with its tone marks is one. */
export function characterCount(text: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    let count = 0;
    for (const _ of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text))
      count += 1;
    return count;
  }
  return [...text].length;
}

export function placeholders(text: string): Set<string> {
  return new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!));
}

function formsOf(text: MessageText): [string, string][] {
  return typeof text === 'string'
    ? [['other', text]]
    : (Object.entries(text).filter(([, v]) => typeof v === 'string') as [string, string][]);
}

/** The CLDR categories a locale actually uses, read from the runtime. English rules when it has no data. */
export function pluralCategoriesFor(locale: string): Intl.LDMLPluralRule[] {
  const info = localeInfo(locale);
  for (const c of info?.intl ?? [locale, 'en-NG']) {
    try {
      if (Intl.PluralRules.supportedLocalesOf([c]).length > 0) {
        return new Intl.PluralRules(c).resolvedOptions().pluralCategories;
      }
    } catch {
      // try the next
    }
  }
  return ['one', 'other'];
}

export function validateTranslation(input: ValidateInput): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const englishPlural = typeof input.english !== 'string';
  const textPlural = typeof input.text !== 'string';
  const wanted = new Set<string>();
  for (const [, v] of formsOf(input.english)) for (const p of placeholders(v)) wanted.add(p);

  let normalized: MessageText;
  if (englishPlural && !textPlural) {
    errors.push('a plural text is required');
    normalized = (input.text as string).normalize('NFC');
  } else if (!englishPlural && textPlural) {
    errors.push('a single text is required');
    normalized = input.text;
  } else if (textPlural) {
    const source = input.text as Record<string, string | undefined>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(source))
      if (typeof v === 'string') out[k] = v.normalize('NFC');
    for (const cat of pluralCategoriesFor(input.locale)) {
      if (!out[cat]?.trim()) errors.push(`missing plural form ${cat}`);
    }
    normalized = out as MessageText;
  } else {
    normalized = (input.text as string).normalize('NFC');
  }

  const englishLength = Math.max(...formsOf(input.english).map(([, v]) => v.length), 1);
  for (const [form, value] of formsOf(normalized)) {
    if (value.trim().length === 0) {
      if (!errors.some((e) => e.startsWith('missing plural form')) || !textPlural)
        errors.push('is empty');
      continue;
    }
    const have = placeholders(value);
    for (const p of have) if (!wanted.has(p)) errors.push(`unknown placeholder {${p}}`);
    if (form !== 'one')
      for (const p of wanted) if (!have.has(p)) errors.push(`missing placeholder {${p}}`);
    if (DASH.test(value)) errors.push('contains an en or em dash');
    if (HTML.test(value)) errors.push('contains HTML');
    if (value.length > englishLength * MAX_RATIO)
      warnings.push('is much longer than the English text');
    if (input.key && TAB_LABEL_KEYS.includes(input.key) && characterCount(value) > TAB_LABEL_MAX)
      warnings.push(TAB_LABEL_WARNING);
  }
  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    normalized,
  };
}
