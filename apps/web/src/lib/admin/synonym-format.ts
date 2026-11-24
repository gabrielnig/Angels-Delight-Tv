/** Client safe helpers for the Discovery tab (no database code). */

export function groupsToText(groups: readonly (readonly string[])[]): string {
  return groups.map((terms) => terms.join(', ')).join('\n');
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const dayNumber = (date: Date) => Math.floor((date.getTime() + LAGOS_OFFSET_MS) / 86_400_000);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Yesterday" or "22 Nov 2026", by the Lagos calendar day (UTC plus one hour, no daylight saving). */
export function dayLabel(date: Date, now: Date): string {
  const diff = dayNumber(now) - dayNumber(date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const local = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
}
