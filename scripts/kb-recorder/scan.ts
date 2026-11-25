import { EMAIL_PATTERN, isFakeDomain, REDACTED } from './redact';

export type FindingKind = 'email' | 'hidden-email' | 'secret' | 'phone' | 'ip';

export interface Finding {
  kind: FindingKind;
  /** First characters and the length only. A finding never repeats the secret it found. */
  excerpt: string;
  index: number;
}

const mask = (value: string): string => {
  const keep = Math.min(3, Math.floor(value.length / 4));
  return `${value.slice(0, keep)}${'*'.repeat(3)} (${value.length} characters)`;
};

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,
  /\b(?:ghp|gho|github_pat|xox[abp])_[A-Za-z0-9_-]{16,}/g,
];
const LONG_TOKEN = /(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{40,}={0,2}(?![A-Za-z0-9+/_-])/g;
const LONG_HEX = /(?<![0-9A-Fa-f-])[0-9A-Fa-f]{32,}(?![0-9A-Fa-f-])/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Nigerian mobiles (07x, 08x, 09x with 11 digits), international numbers, and dashed or spaced groups of 3, 3 and 4.
const PHONE_PATTERNS: RegExp[] = [
  /(?<![\d.:])0[789][01]\d[\s-]?\d{3}[\s-]?\d{4}(?![\d])/g,
  /(?<![\w])\+\d{1,3}[\s-]?\(?\d{2,4}\)?(?:[\s-]?\d{2,4}){2,3}(?![\d])/g,
  /(?<![\d.:/-])\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\d])/g,
];

const IP = /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.]*\d)/g;
const SAFE_IP = [
  /^127\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
];

/**
 * Finds data that must never appear in a recording or a screenshot: a real looking email, a key, token or secret,
 * a phone number, an IP address outside the documentation ranges, or the marker the page redactor leaves when it had
 * to hide an email. Reserved example domains are fine. Findings carry a masked excerpt only.
 */
export function scanText(text: string, o: { allow?: string[] } = {}): Finding[] {
  const allow = new Set(o.allow ?? []);
  const out: Finding[] = [];
  const spans: Array<[number, number]> = [];
  const add = (kind: FindingKind, value: string, index: number) => {
    if (allow.has(value)) return;
    const end = index + value.length;
    // One piece of data is one finding, even when two patterns match overlapping text.
    if (spans.some(([a, b]) => index < b && end > a)) return;
    spans.push([index, end]);
    out.push({ kind, excerpt: mask(value), index });
  };

  for (const m of text.matchAll(new RegExp(EMAIL_PATTERN, 'g'))) {
    if (!isFakeDomain(m[0].slice(m[0].lastIndexOf('@') + 1))) add('email', m[0], m.index);
  }
  for (let i = text.indexOf(REDACTED); i !== -1; i = text.indexOf(REDACTED, i + 1)) {
    add('hidden-email', REDACTED, i);
  }
  for (const re of SECRET_PATTERNS) {
    for (const m of text.matchAll(re)) add('secret', m[0], m.index);
  }
  for (const m of text.matchAll(LONG_HEX)) {
    if (!UUID.test(m[0])) add('secret', m[0], m.index);
  }
  for (const m of text.matchAll(LONG_TOKEN)) {
    const v = m[0];
    if (/[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v)) add('secret', v, m.index);
  }
  for (const re of PHONE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      if (m[0].replace(/\D/g, '').length >= 10) add('phone', m[0], m.index);
    }
  }
  for (const m of text.matchAll(IP)) {
    const octets = m.slice(1, 5).map(Number);
    if (octets.some((n) => n > 255)) continue;
    if (!SAFE_IP.some((re) => re.test(m[0]))) add('ip', m[0], m.index);
  }
  return out.sort((a, b) => a.index - b.index);
}

/** One message for a failed capture. Names where it happened and what kind of data, never the data. */
export function formatFindings(where: string, findings: Finding[]): string {
  const lines = findings.map((f) => `  ${f.kind} at character ${f.index}: ${f.excerpt}`);
  return `Capture refused at ${where}: real looking data on screen\n${lines.join('\n')}`;
}
