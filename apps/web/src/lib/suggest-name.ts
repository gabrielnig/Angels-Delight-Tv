/** A starting name for a first profile, from the email prefix (M03-S02 AC4). */
export function suggestProfileName(email: string): string {
  const prefix = email.split('@')[0] ?? '';
  const words = prefix
    .split('+')[0]!
    .split(/[._-]+/)
    .map((word) => word.replace(/[^\p{L}]/gu, ''))
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase());
  return words.join(' ').slice(0, 20).trim();
}
