/** Crockford style alphabet: no I, L, O or U, so a code read out over the phone is not mixed up. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A short code the viewer can quote to support, shown as `Reference: AD-7K4Q` (R39, DESIGN-SYSTEM 11.21). */
export function makeReference(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out += ALPHABET[Math.min(ALPHABET.length - 1, Math.floor(random() * ALPHABET.length))];
  }
  return `AD-${out}`;
}
