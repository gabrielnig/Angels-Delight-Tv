const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY = 86_400_000;
const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** The heading a watch time falls under, in UTC to match the rest of the account screens. */
export function activityLabel(watchedAt: string, now: Date): string {
  const at = new Date(watchedAt);
  const days = Math.round((dayStart(now) - dayStart(at)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Earlier this week';
  return `${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}

/** Newest first input in, labelled groups out. Neighbours with the same label share a group. */
export function groupActivity<T extends { watchedAt: string }>(
  items: T[],
  now: Date,
): Array<{ label: string; items: T[] }> {
  const groups: Array<{ label: string; items: T[] }> = [];
  for (const item of items) {
    const label = activityLabel(item.watchedAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
