/**
 * Small KB tools next to the recorder (lane L14):
 *   tsx scripts/kb-recorder/tools.ts shots-diff --run .kb-out/nightly --baseline content/help/media [--out .kb-out/diffs] [--max-percent 0.5] [--strict]
 *   tsx scripts/kb-recorder/tools.ts publish --run .kb-out/nightly [--run <more runs>] [--only D02,D03] --release v1.0.0 --dest dist-media
 *   tsx scripts/kb-recorder/tools.ts steps --episode D02 [--check]
 */
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { exitCodeFor } from './exit-code';
import type { Manifest } from './manifest';
import { publishRuns } from './publish';
import { loadAllEpisodes } from './registry';
import { renderStepsBlock } from './steps-block';
import { compareImages } from './shot-diff';
import { findArticle, updateArticleSteps } from './update';

const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: {
    run: { type: 'string', multiple: true },
    only: { type: 'string' },
    baseline: { type: 'string', default: 'content/help/media' },
    out: { type: 'string', default: '.kb-out/diffs' },
    'max-percent': { type: 'string', default: '0.5' },
    strict: { type: 'boolean', default: false },
    release: { type: 'string' },
    dest: { type: 'string' },
    episode: { type: 'string' },
    content: { type: 'string', default: 'content/help' },
    check: { type: 'boolean', default: false },
  },
});

async function manifestOf(run: string | undefined): Promise<Manifest> {
  if (!run) throw new Error('Pass --run <run folder>');
  return JSON.parse(await readFile(resolve(run, 'manifest.json'), 'utf8')) as Manifest;
}

async function shotsDiff(): Promise<void> {
  if (!values.run?.length) throw new Error('Pass --run <run folder>');
  const manifest = await manifestOf(values.run[0]);
  const max = Number(values['max-percent']) / 100;
  await mkdir(resolve(values.out!), { recursive: true });
  const failures: string[] = [];
  let compared = 0;
  for (const e of manifest.episodes) {
    for (const p of e.profiles) {
      for (const s of p.shots) {
        const name = basename(s.file);
        const baseline = resolve(values.baseline!, e.id, name);
        if (!existsSync(baseline)) {
          const msg = `${e.id} ${name}: no baseline yet (run pnpm kb:update ${e.id} and commit the pictures)`;
          if (values.strict) failures.push(msg);
          else console.log(`new  ${msg}`);
          continue;
        }
        compared++;
        const r = await compareImages(baseline, resolve(values.run, s.file), {
          masks: s.masks,
          diffOut: join(resolve(values.out!), name.replace(/\.webp$/, '.diff.png')),
        });
        const pct = (r.ratio * 100).toFixed(2);
        if (r.sizeChanged || r.ratio > max) {
          failures.push(
            `${e.id} ${name}: ${r.sizeChanged ? 'size changed' : `${pct} percent of pixels changed`}, limit ${values['max-percent']} percent (diff in ${values.out})`,
          );
        } else console.log(`same ${e.id} ${name} (${pct} percent)`);
      }
    }
  }
  console.log(`${compared} picture(s) compared.`);
  if (failures.length) {
    console.error(
      `A screen changed. Fix: pnpm kb:update <id> and commit the reviewed pictures.\n${failures.map((f) => `  ${f}`).join('\n')}`,
    );
    process.exit(1);
  }
}

async function publish(): Promise<void> {
  if (!values.run?.length || !values.release || !values.dest)
    throw new Error('Pass --run (repeat it for several runs), --release and --dest');
  const runs = await Promise.all(
    values.run.map(async (r) => ({ dir: resolve(r), manifest: await manifestOf(r) })),
  );
  const n = await publishRuns({
    runs,
    release: values.release,
    dest: resolve(values.dest),
    only: values.only
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  });
  console.log(
    `${n} file(s) written under ${resolve(values.dest)}/help/${values.release}/. Upload that folder to the media bucket.`,
  );
}

async function steps(): Promise<void> {
  if (!values.episode) throw new Error('Pass --episode <id>');
  const episodes = await loadAllEpisodes();
  const problems: string[] = [];
  for (const id of values.episode.split(',').map((s) => s.trim())) {
    const e = episodes.find((x) => x.id === id);
    if (!e) throw new Error(`Unknown episode "${id}"`);
    const file = findArticle(resolve(values.content!), id);
    if (!file) {
      console.log(`${id}: no article yet`);
      continue;
    }
    if (values.check) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes(renderStepsBlock(e).trimEnd()))
        problems.push(
          `${id}: the steps block in ${file} does not match the episode (run pnpm kb:steps ${id})`,
        );
    } else {
      updateArticleSteps(resolve(values.content!), e);
      console.log(`${id}: steps written to ${file}`);
    }
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}

const commands: Record<string, () => Promise<void>> = { 'shots-diff': shotsDiff, publish, steps };

(
  commands[command ?? ''] ??
  (async () => {
    throw new Error('Commands: shots-diff, publish, steps');
  })
)().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(exitCodeFor(e));
});
