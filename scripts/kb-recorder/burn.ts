import { spawn } from 'node:child_process';

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

/** Re-encodes the raw Playwright webm to a 30 fps H.264 mp4 and burns the ASS captions into it. */
export async function burnCaptions(o: {
  input: string;
  ass: string;
  output: string;
  fontsDir?: string;
  fps?: number;
}): Promise<void> {
  const esc = (p: string) => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const filter = `fps=${o.fps ?? 30},ass='${esc(o.ass)}'${o.fontsDir ? `:fontsdir='${esc(o.fontsDir)}'` : ''}`;
  await run('ffmpeg', [
    '-y',
    '-v',
    'error',
    '-i',
    o.input,
    '-vf',
    filter,
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
