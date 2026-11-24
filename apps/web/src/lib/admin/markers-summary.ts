import type { ChapterInput, MarkerInput } from '@ad/video/markers';

const clock = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

/** One line for the video page card, for example "Intro 0:12 to 0:48, credits from 5:10, 6 chapters". Null when nothing is set. */
export function markersSummary(markers: MarkerInput[], chapters: ChapterInput[]): string | null {
  const parts: string[] = [];
  const by = (kind: MarkerInput['kind']) => markers.find((m) => m.kind === kind);
  const intro = by('intro');
  const recap = by('recap');
  const credits = by('credits');
  if (intro && intro.endMs !== null) parts.push(`Intro ${clock(intro.startMs)} to ${clock(intro.endMs)}`);
  if (recap && recap.endMs !== null) parts.push(`recap ${clock(recap.startMs)} to ${clock(recap.endMs)}`);
  if (credits) parts.push(`credits from ${clock(credits.startMs)}`);
  if (chapters.length > 0) parts.push(`${chapters.length} chapter${chapters.length === 1 ? '' : 's'}`);
  if (parts.length === 0) return null;
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
