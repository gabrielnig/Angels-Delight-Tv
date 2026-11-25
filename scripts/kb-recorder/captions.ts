/** Pure caption helpers for the KB recorder: parse and write WebVTT and SRT, build cues from step timings, make ASS. */

export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
  /** Top places the caption at the top of the frame so it does not cover the target. Default bottom. */
  position?: 'top' | 'bottom';
}

export interface StepTiming {
  caption: string | undefined;
  /** Name of the control the pointer went to in this step, for the transcript. */
  pointer?: string;
  /** Starts a chapter of this name. */
  chapter?: string;
  position?: 'top' | 'bottom';
  startMs: number;
  endMs: number;
}

const TS = /^(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})$/;

export function parseTimestamp(raw: string): number {
  const m = TS.exec(raw.trim());
  if (!m) throw new Error(`Bad timestamp "${raw}"`);
  const [, h, min, s, ms] = m;
  if (Number(min) > 59 || Number(s) > 59) throw new Error(`Bad timestamp "${raw}"`);
  return (Number(h ?? 0) * 3600 + Number(min) * 60 + Number(s)) * 1000 + Number(ms);
}

export function formatTimestamp(ms: number, sep: '.' | ','): string {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const milli = total % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(milli, 3)}`;
}

/** Reads WebVTT or SRT. NOTE and STYLE blocks, cue numbers, identifiers and cue settings are ignored. */
export function parseCues(input: string): Cue[] {
  const blocks = input
    .replace(/\r\n?/g, '\n')
    .replace(new RegExp('^' + String.fromCharCode(0xfeff)), '')
    .split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .filter((l, i, all) => !(l === '' && (i === 0 || i === all.length - 1)));
    if (lines.length === 0) continue;
    if (/^WEBVTT/.test(lines[0]!) || /^(NOTE|STYLE|REGION)(\s|$)/.test(lines[0]!)) continue;
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at === -1 || at > 1) {
      if (lines.every((l) => l.trim() === '')) continue;
      throw new Error(`Cue block without a valid timing line: "${lines[0]}"`);
    }
    const m = /^(\S+)\s+-->\s+(\S+)/.exec(lines[at]!);
    if (!m) throw new Error(`Bad timing line "${lines[at]}"`);
    cues.push({
      startMs: parseTimestamp(m[1]!),
      endMs: parseTimestamp(m[2]!),
      text: lines
        .slice(at + 1)
        .join('\n')
        .trim(),
    });
  }
  return cues;
}

export function validateCues(cues: Cue[]): string[] {
  const problems: string[] = [];
  cues.forEach((c, i) => {
    const n = i + 1;
    if (c.text.trim() === '') problems.push(`cue ${n} is empty`);
    if (c.endMs < c.startMs) problems.push(`cue ${n} ends before it starts`);
    else if (c.endMs === c.startMs) problems.push(`cue ${n} has zero length`);
    const prev = cues[i - 1];
    if (prev) {
      if (c.startMs < prev.startMs) problems.push(`cue ${n} is out of order`);
      else if (c.startMs < prev.endMs) problems.push(`cue ${n} overlaps cue ${n - 1}`);
    }
  });
  return problems;
}

export function toVtt(cues: Cue[]): string {
  const body = cues
    .map(
      (c) => `${formatTimestamp(c.startMs, '.')} --> ${formatTimestamp(c.endMs, '.')}\n${c.text}`,
    )
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}

export function toSrt(cues: Cue[]): string {
  return (
    cues
      .map(
        (c, i) =>
          `${i + 1}\n${formatTimestamp(c.startMs, ',')} --> ${formatTimestamp(c.endMs, ',')}\n${c.text}`,
      )
      .join('\n\n') + '\n'
  );
}

export interface AssOptions {
  width: number;
  height: number;
  fontSize: number;
  marginX: number;
  marginV: number;
  fontName: string;
  /** Fixed corner badges such as "Step 3 of 7". */
  badges?: Cue[];
  /** Full frame title and end cards. */
  cards?: Array<{ startMs: number; endMs: number; lines: string[] }>;
}

const assTime = (ms: number) => {
  const cs = Math.round(Math.max(0, ms) / 10);
  const h = Math.floor(cs / 360_000);
  const m = Math.floor((cs % 360_000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

/** ASS lets us size text in real pixels (PlayRes equals the video) and keep margins, which SRT force_style cannot. */
export function toAss(cues: Cue[], o: AssOptions): string {
  const esc = (t: string) => t.replace(/[{}\\]/g, '').replace(/\n/g, '\\N');
  const caps = cues
    .map(
      (c) =>
        `Dialogue: 0,${assTime(c.startMs)},${assTime(c.endMs)},Caption,,0,0,0,,${c.position === 'top' ? '{\\an8}' : ''}${esc(c.text)}`,
    )
    .join('\n');
  const badges = (o.badges ?? []).map(
    (b) => `Dialogue: 1,${assTime(b.startMs)},${assTime(b.endMs)},Badge,,0,0,0,,${esc(b.text)}`,
  );
  const cards = (o.cards ?? []).flatMap((card) => [
    `Dialogue: 5,${assTime(card.startMs)},${assTime(card.endMs)},Panel,,0,0,0,,{\\p1}m 0 0 l ${o.width} 0 ${o.width} ${o.height} 0 ${o.height}{\\p0}`,
    `Dialogue: 6,${assTime(card.startMs)},${assTime(card.endMs)},Card,,0,0,0,,${card.lines.map(esc).join('\\N')}`,
  ]);
  const events = [caps, ...badges, ...cards].filter(Boolean).join('\n');
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${o.width}`,
    `PlayResY: ${o.height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    // BorderStyle 3 draws a box behind the text in the outline colour: white on 90 percent black stays readable on any screen.
    `Style: Caption,${o.fontName},${o.fontSize},&H00FFFFFF,&H00FFFFFF,&H1A000000,&H1A000000,-1,0,0,0,100,100,0,0,3,10,0,2,${o.marginX},${o.marginX},${o.marginV},1`,
    `Style: Badge,${o.fontName},${Math.round(o.fontSize * 0.55)},&H00FFFFFF,&H00FFFFFF,&H33000000,&H33000000,-1,0,0,0,100,100,0,0,3,6,0,9,16,16,16,1`,
    `Style: Panel,${o.fontName},20,&H00241B14,&H00241B14,&H00241B14,&H00241B14,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
    `Style: Card,${o.fontName},${Math.round(o.fontSize * 1.5)},&H00FFFFFF,&H00FFFFFF,&H00241B14,&H00241B14,-1,0,0,0,100,100,0,0,1,0,0,5,${o.marginX},${o.marginX},0,1`,
    '',
    '[Events]',
    'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
    events,
    '',
  ].join('\n');
}

/**
 * Cues from measured step timings. leadMs delays the caption slightly after the step starts so the viewer sees the
 * action first. A cue shorter than minMs is stretched, but never into the next cue.
 */
export function buildCues(
  steps: StepTiming[],
  o: { leadMs: number; minMs: number; maxMs?: number; wrap?: boolean },
): Cue[] {
  const withText = steps.filter((s): s is StepTiming & { caption: string } => Boolean(s.caption));
  return withText.map((s, i) => {
    const startMs = s.startMs + o.leadMs;
    let endMs = Math.max(s.endMs, startMs + o.minMs);
    const next = withText[i + 1];
    if (next) endMs = Math.min(endMs, next.startMs + o.leadMs);
    if (o.maxMs !== undefined) endMs = Math.min(endMs, startMs + o.maxMs);
    return {
      startMs,
      endMs: Math.max(endMs, startMs),
      text: o.wrap ? wrapCaption(s.caption) : s.caption,
      ...(s.position ? { position: s.position } : {}),
    };
  });
}

/** How long a caption needs on screen so a calm reader finishes it: 2 s floor, then 67 ms per character, the 15 characters a second of the style guide. */
export function readingTimeMs(text: string): number {
  const chars = text.replace(/\n/g, '').length;
  return Math.max(2000, 400 + chars * 67);
}

/** Longest caption line in characters (style guide, plan section 5.3). */
export const MAX_LINE = 42;

/** Breaks a caption at spaces into at most two balanced lines of 42 characters. Text that cannot fit stays as is. */
export function wrapCaption(text: string, max = MAX_LINE): string {
  const flat = text.replace(/\s*\n\s*/g, ' ').trim();
  if (flat.length <= max) return flat;
  const words = flat.split(' ');
  let best: [string, string] | null = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    if (a.length <= max && b.length <= max) {
      if (!best || Math.abs(a.length - b.length) < Math.abs(best[0].length - best[1].length))
        best = [a, b];
    }
  }
  return best ? `${best[0]}\n${best[1]}` : flat;
}
