import { msg as defaultMsg, type Translate } from '@ad/shared/messages';

function whole(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
}

/** "2:14" or "1:02:03". Safe for NaN, negative and infinite input. */
export function formatClock(seconds: number): string {
  const s = whole(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "2 minutes 14 seconds" for screen readers. Units come from the catalog so they follow the viewer's language. */
export function spokenTime(seconds: number, msg: Translate = defaultMsg): string {
  const s = whole(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(msg('player.time.hour', { count: h }));
  if (m > 0) parts.push(msg('player.time.minute', { count: m }));
  if (sec > 0 || parts.length === 0) parts.push(msg('player.time.second', { count: sec }));
  return parts.join(' ');
}

/** aria-valuetext for the seek slider: "2 minutes 14 seconds of 6 minutes". */
export function seekValueText(
  current: number,
  duration: number,
  msg: Translate = defaultMsg,
): string {
  if (!Number.isFinite(duration) || duration <= 0) return spokenTime(current, msg);
  return msg('player.seek.valueOf', {
    current: spokenTime(current, msg),
    duration: spokenTime(duration, msg),
  });
}
