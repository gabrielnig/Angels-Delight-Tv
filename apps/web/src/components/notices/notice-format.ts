import { msg } from '@ad/shared/messages';

const ZONE = 'Africa/Lagos';

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(date);
}

/** "Today, 8:40 am", "Yesterday", the weekday for the last week, else "2 Nov". Lagos time, like the digest. */
export function formatNoticeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = dayKey(now);
  const day = dayKey(date);
  if (day === today) {
    const time = new Intl.DateTimeFormat('en-NG', { timeZone: ZONE, hour: 'numeric', minute: '2-digit', hour12: true })
      .format(date)
      .replace(/\u202f/g, ' ')
      .toLowerCase();
    return msg('engage.notices.today', { time });
  }
  const days = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
  if (days === 1) return msg('engage.notices.yesterday');
  if (days > 1 && days < 7)
    return new Intl.DateTimeFormat('en-NG', { timeZone: ZONE, weekday: 'long' }).format(date);
  return new Intl.DateTimeFormat('en-NG', { timeZone: ZONE, day: 'numeric', month: 'short' }).format(date);
}

/** The spoken name of the bell: the real count, even when the badge says 9+. */
export function spokenUnread(count: number | null): string {
  if (count === null) return msg('engage.notices.bell');
  if (count <= 0) return msg('engage.notices.noneUnread');
  return msg('engage.notices.unreadSpoken', { count });
}
