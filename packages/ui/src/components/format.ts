/** Time and length wording from docs/DESIGN-SYSTEM.md section 14: "4 min", "1 hr 20 min", "12 min left". */

function minutesOf(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

export function formatDuration(seconds: number): string {
  const total = minutesOf(seconds);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

export function formatTimeLeft(seconds: number): string {
  const total = minutesOf(seconds);
  return `${formatDuration(total * 60)} left`;
}

/** m:ss or h:mm:ss for badges and the player clock. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

const unit = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Exact reading for assistive technology: "4 minutes 12 seconds". */
export function spokenDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  const parts: string[] = [];
  if (hours) parts.push(unit(hours, 'hour'));
  if (minutes) parts.push(unit(minutes, 'minute'));
  if (rest || parts.length === 0) parts.push(unit(rest, 'second'));
  return parts.join(' ');
}

/** Approximate reading for card names: "4 minutes". */
export function spokenLength(seconds: number): string {
  const total = minutesOf(seconds);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return unit(minutes, 'minute');
  return minutes === 0 ? unit(hours, 'hour') : `${unit(hours, 'hour')} ${unit(minutes, 'minute')}`;
}
