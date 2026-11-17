export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Spoken form for screen readers: "4 minutes 12 seconds". */
export function spokenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (m === 0) return part(sec, 'second');
  return sec === 0 ? part(m, 'minute') : `${part(m, 'minute')} ${part(sec, 'second')}`;
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}k`;
  return String(value);
}

const TZ = 'Africa/Lagos';

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', timeZone: TZ }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  })
    .format(new Date(iso))
    .replace(/\s?(am|pm)/i, (m) => m.trim().toUpperCase().padStart(3, ' '));
}

/** The value for an input of type datetime-local, in Lagos time, from an ISO string. */
export function toLagosInput(iso: string): string {
  const d = new Date(Date.parse(iso) + 3_600_000);
  return d.toISOString().slice(0, 16);
}

/** Lagos is UTC+1 all year, so a local input value maps to a fixed offset. */
export function fromLagosInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}:00Z`) - 3_600_000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function formatRelative(iso: string, now: number): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}
