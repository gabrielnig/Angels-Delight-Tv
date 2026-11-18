import { inputSafety } from './encode/ffmpeg';
import type { Container } from './magic';

export interface SpritePlan {
  intervalSeconds: number;
  columns: number;
  tileWidth: number;
  tileHeight: number;
  frames: number;
  /** Tiles per sheet, columns times rows. */
  perSheet: number;
  rows: number;
  sheets: number;
}

const COLUMNS = 5;
const ROWS = 5;
const TILE_WIDTH = 160;
const BASE_INTERVAL = 5;
const MAX_SHEETS = 10;

/** One frame every 5 seconds in sheets of 5 by 5 (M36-S04). Long videos get a wider interval, so storage stays small. */
export function planSprite(input: {
  durationSeconds: number;
  width: number;
  height: number;
}): SpritePlan | null {
  const { durationSeconds, width, height } = input;
  if (!(durationSeconds > 0) || !(width > 0) || !(height > 0)) return null;
  const perSheet = COLUMNS * ROWS;
  const intervalSeconds = Math.max(
    BASE_INTERVAL,
    Math.ceil(durationSeconds / (MAX_SHEETS * perSheet)),
  );
  const frames = Math.max(1, Math.ceil(durationSeconds / intervalSeconds));
  const tileHeight = 2 * Math.round((TILE_WIDTH * height) / width / 2);
  return {
    intervalSeconds,
    columns: COLUMNS,
    rows: ROWS,
    tileWidth: TILE_WIDTH,
    tileHeight,
    frames,
    perSheet,
    sheets: Math.ceil(frames / perSheet),
  };
}

function clock(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** WebVTT map from time ranges to a tile of a sheet. `sheetUrls[i]` is the url written in the cues of sheet i. */
export function buildSpriteVtt(
  plan: SpritePlan,
  durationSeconds: number,
  sheetUrls: readonly string[],
): string {
  if (sheetUrls.length < plan.sheets)
    throw new Error(`Expected ${plan.sheets} sheets but got ${sheetUrls.length}`);
  const cues: string[] = [];
  for (let index = 0; index < plan.frames; index++) {
    const start = index * plan.intervalSeconds;
    const end = Math.min(start + plan.intervalSeconds, durationSeconds);
    const sheet = Math.floor(index / plan.perSheet);
    const slot = index % plan.perSheet;
    const x = (slot % plan.columns) * plan.tileWidth;
    const y = Math.floor(slot / plan.columns) * plan.tileHeight;
    cues.push(
      `${clock(start)} --> ${clock(end)}\n${sheetUrls[sheet]}#xywh=${x},${y},${plan.tileWidth},${plan.tileHeight}`,
    );
  }
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

export function spriteArgs(options: {
  input: string;
  container: Container;
  plan: SpritePlan;
  outputPattern: string;
}): string[] {
  const { plan } = options;
  return [
    '-nostdin',
    '-hide_banner',
    '-y',
    '-loglevel',
    'error',
    ...inputSafety(options.container),
    '-i',
    options.input,
    '-an',
    '-sn',
    '-vf',
    `fps=1/${plan.intervalSeconds},scale=${plan.tileWidth}:${plan.tileHeight},tile=${plan.columns}x${plan.rows}`,
    '-q:v',
    '6',
    options.outputPattern,
  ];
}
