import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { burnCaptions } from './burn';
import { lintCues } from './caption-style';
import { buildCues, toAss, toVtt, validateCues, type Cue, type StepTiming } from './captions';
import type { Profile } from './profiles';
import {
  buildCards,
  buildStepBadges,
  CARD_MS,
  chapterList,
  remapMs,
  renderChaptersVtt,
  renderTranscript,
  type Skip,
} from './transcript';

const exec = promisify(execFile);

export interface ProduceInput {
  id: string;
  title: string;
  audience: string;
  profile: Profile;
  /** The clean capture with no captions. */
  raw: string;
  outDir: string;
  /** Length of the raw capture in milliseconds. */
  totalMs: number;
  timings: StepTiming[];
  skips?: Skip[];
  /** "D03 Upload many videos": shows on the end card. */
  next?: string;
}

export interface ProduceOutput {
  mp4: string;
  vtt: string;
  ass: string;
  transcript: string;
  chapters: string;
  durationMs: number;
  cues: Cue[];
  /** Caption style problems (timing, lines, speed). Empty means the style guide is met. */
  cueProblems: string[];
}

const lengthLabel = (ms: number) => {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s} s` : `${m} min ${s % 60} s`;
};

/**
 * From a clean capture and the measured step timings to the published files: the burned in mp4 (title card, step
 * badge, end card, skipped waits cut), the VTT, the ASS source, the transcript and the chapters. Every time in every
 * file is in the final video's clock, so the VTT lines up with the mp4.
 */
export async function produceOutputs(i: ProduceInput): Promise<ProduceOutput> {
  const skips = i.skips ?? [];
  const keptMs = remapMs(i.totalMs, skips);
  const mapped: StepTiming[] = i.timings.map((t) => ({
    ...t,
    startMs: remapMs(t.startMs, skips) + CARD_MS,
    endMs: remapMs(t.endMs, skips) + CARD_MS,
  }));
  const cues = buildCues(mapped, { leadMs: 250, minMs: 2000, maxMs: 6000, wrap: true });
  const problems = [...validateCues(cues), ...lintCues(cues)];
  const hard = validateCues(cues);
  if (hard.length) throw new Error(`Caption problems: ${hard.join('; ')}`);

  const badges: Cue[] = [
    ...buildStepBadges(mapped),
    ...skips.map((s) => {
      const at = remapMs(s.startMs, skips) + CARD_MS;
      return { startMs: at, endMs: at + 1500, text: 'Time skipped' };
    }),
  ];
  const cards = buildCards({
    id: i.id,
    title: i.title,
    audience: i.audience,
    lengthLabel: lengthLabel(keptMs),
    next: i.next,
    totalMs: keptMs,
  });
  const stem = join(i.outDir, `${i.id}-${i.profile.name}`);
  const files = {
    mp4: `${stem}.mp4`,
    vtt: `${stem}.vtt`,
    ass: `${stem}.ass`,
    transcript: `${stem}.transcript.txt`,
    chapters: `${stem}.chapters.vtt`,
  };
  await writeFile(files.vtt, toVtt(cues));
  await writeFile(
    files.ass,
    toAss(cues, {
      width: i.profile.width,
      height: i.profile.height,
      fontSize: i.profile.captionFontSize,
      marginX: i.profile.captionMarginX,
      marginV: i.profile.captionMarginV,
      fontName: 'Inter',
      badges,
      cards,
    }),
  );
  const captioned = mapped.filter((t) => t.caption);
  await writeFile(
    files.transcript,
    renderTranscript({
      id: i.id,
      title: i.title,
      audience: i.audience,
      totalMs: keptMs + CARD_MS * (i.next ? 2 : 1),
      steps: captioned.map((t, n) => ({
        n: n + 1,
        caption: t.caption!,
        startMs: t.startMs,
        pointer: t.pointer,
      })),
    }),
  );
  const finalMs = keptMs + CARD_MS + (i.next ? CARD_MS : 0);
  await writeFile(files.chapters, renderChaptersVtt(chapterList(mapped), finalMs));
  await burnCaptions({
    input: i.raw,
    ass: files.ass,
    output: files.mp4,
    skips,
    cards: { end: Boolean(i.next) },
  });
  const probe = await exec('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    files.mp4,
  ]);
  return {
    ...files,
    durationMs: Math.round(Number(probe.stdout.trim()) * 1000),
    cues,
    cueProblems: problems.filter((p) => !hard.includes(p)),
  };
}
