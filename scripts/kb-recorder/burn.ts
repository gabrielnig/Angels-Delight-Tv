import { spawn } from 'node:child_process';
import { CARD_MS, skipSelectExpression, type Skip } from './transcript';

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += String(d)));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err.slice(-1500)}`)),
    );
  });
}

/**
 * Re-encodes the raw Playwright webm to a 30 fps H.264 mp4 with no audio and burns the ASS captions into it.
 * Skipped waits are cut out first. With `cards` the first and last frame are held for 3 seconds each, which is where
 * the title and end cards of the ASS file show.
 */
export async function burnCaptions(o: {
  input: string;
  ass: string;
  output: string;
  fontsDir?: string;
  fps?: number;
  skips?: Skip[];
  /** Hold the first frame for the title card, and the last for an end card when `end` is true. */
  cards?: { end: boolean };
}): Promise<void> {
  const esc = (p: string) => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const chain: string[] = [];
  const select = skipSelectExpression(o.skips ?? []);
  if (select) chain.push(select, 'setpts=N/FRAME_RATE/TB');
  chain.push(`fps=${o.fps ?? 30}`);
  if (o.cards) {
    const s = CARD_MS / 1000;
    chain.push(
      `tpad=start_duration=${s}:stop_duration=${o.cards.end ? s : 0}:start_mode=clone:stop_mode=clone`,
    );
  }
  chain.push(`ass='${esc(o.ass)}'${o.fontsDir ? `:fontsdir='${esc(o.fontsDir)}'` : ''}`);
  await run('ffmpeg', [
    '-y',
    '-v',
    'error',
    '-i',
    o.input,
    '-vf',
    chain.join(','),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    o.output,
  ]);
}
