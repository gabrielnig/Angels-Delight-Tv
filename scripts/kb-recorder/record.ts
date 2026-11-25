/**
 * KB recorder CLI (lane L14). Examples:
 *   pnpm kb:record --episode H02-videos-list           one episode, desktop and phone as the episode asks
 *   pnpm kb:record --path daily                        every episode of a learning path
 *   pnpm kb:record --changed                           only episodes affected by changed files
 *   pnpm kb:record --all                               everything
 *   pnpm kb:verify --changed                           locator check only, no video, for pull requests
 * Output: .kb-out/<run>/<id>/<profile>/..., and .kb-out/<run>/manifest.json for the platform.
 * See docs/lanes/L14-build.md for the stack and docs/spikes/kb-recording.md for background.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { assertAllowedOrigin } from './demo/origin-guard';
import { validateEpisode } from './episode';
import { changedFiles } from './git-changes';
import { compareManifests, type Manifest, type ManifestProfile } from './manifest';
import {
  manifestEntry,
  recordProfile,
  verifyProfile,
  writeManifest,
  CheckFailed,
} from './pipeline';
import { PROFILES, type Profile } from './profiles';
import { loadAllEpisodes } from './registry';
import { selectEpisodes } from './select';
import { exitCodeFor } from './exit-code';
import { copyShotsToBaseline, updateArticleSteps } from './update';

const { values } = parseArgs({
  options: {
    episode: { type: 'string' },
    path: { type: 'string' },
    changed: { type: 'boolean', default: false },
    all: { type: 'boolean', default: false },
    base: { type: 'string', default: 'origin/main' },
    files: { type: 'string' },
    profile: { type: 'string' },
    out: { type: 'string', default: '.kb-out' },
    run: { type: 'string', default: 'run1' },
    'base-url': { type: 'string', default: process.env.KB_BASE_URL ?? 'http://localhost:3141' },
    'no-warm': { type: 'boolean', default: false },
    'no-reset': { type: 'boolean', default: false },
    'no-shots': { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    report: { type: 'string' },
    pace: { type: 'string', default: '1' },
    'min-seconds': { type: 'string', default: '10' },
    'max-seconds': { type: 'string', default: '240' },
    'max-mb': { type: 'string', default: '5' },
    compare: { type: 'string' },
    list: { type: 'boolean', default: false },
    update: { type: 'boolean', default: false },
    content: { type: 'string', default: 'content/help' },
  },
});

async function main(): Promise<void> {
  const baseURL = values['base-url']!;
  assertAllowedOrigin(baseURL);
  const episodes = await loadAllEpisodes();
  for (const e of episodes) {
    const problems = validateEpisode(e);
    if (problems.length) throw new Error(`Episode ${e.id}: ${problems.join('; ')}`);
  }
  const files = values.changed
    ? values.files
      ? values.files.split(',')
      : await changedFiles(values.base)
    : [];
  const chosen = selectEpisodes(
    episodes,
    { episode: values.episode, path: values.path, changed: values.changed, all: values.all },
    files,
  );
  if (values.list) {
    for (const e of chosen) console.log(e.id);
    return;
  }
  if (chosen.length === 0) {
    console.log('No episode is affected, nothing to do.');
    return;
  }
  const profilesFor = (e: (typeof chosen)[number]): Profile[] =>
    (values.profile
      ? values.profile.split(',').map((n) => n.trim())
      : (e.viewports ?? ['desktop'])
    ).map((n) => {
      const p = PROFILES[n as Profile['name']];
      if (!p) throw new Error(`Unknown profile ${n}`);
      return p;
    });

  if (values.check) {
    const failures: Array<{
      episode: string;
      profile: string;
      step: number;
      caption: string;
      message: string;
    }> = [];
    for (const e of chosen) {
      for (const p of profilesFor(e)) {
        const r = await verifyProfile(e, p, { baseURL, reset: !values['no-reset'] });
        console.log(
          `${r.ok ? 'ok  ' : 'FAIL'} ${e.id} ${p.name}${r.ok ? '' : ` step ${r.step}: ${r.message}`}`,
        );
        if (!r.ok)
          failures.push({
            episode: e.id,
            profile: p.name,
            step: r.step,
            caption: r.caption,
            message: r.message,
          });
      }
    }
    if (values.report)
      await writeFile(
        resolve(values.report),
        JSON.stringify({ checked: chosen.map((e) => e.id), failures }, null, 2) + '\n',
      );
    if (failures.length) {
      console.error(
        `${failures.length} episode check(s) failed. A screen changed, so the article and video are out of date.`,
      );
      process.exit(1);
    }
    return;
  }

  const options = {
    baseURL,
    out: values.out!,
    run: values.run!,
    pace: Number(values.pace),
    warm: !values['no-warm'],
    reset: !values['no-reset'],
    shots: !values['no-shots'],
    limits: {
      minSeconds: Number(values['min-seconds']),
      maxSeconds: Number(values['max-seconds']),
      maxBytes: Number(values['max-mb']) * 1024 * 1024,
    },
  };
  const entries = [];
  const failed: string[] = [];
  for (const e of chosen) {
    const profiles: ManifestProfile[] = [];
    for (const p of profilesFor(e)) {
      try {
        const r = await recordProfile(e, p, options);
        profiles.push(r.entry);
        console.log(
          JSON.stringify({
            episode: e.id,
            profile: p.name,
            durationMs: r.entry.durationMs,
            bytes: r.entry.bytes,
            shots: r.entry.shots.length,
            ...r.timings,
          }),
        );
      } catch (err) {
        failed.push(
          `${e.id} ${p.name}: ${err instanceof CheckFailed ? err.problems.join('; ') : err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (profiles.length) entries.push(manifestEntry(e, profiles));
    if (values.update && profiles.length) {
      // kb:update: refresh the committed pictures and the article steps block for review.
      const content = resolve(values.content!);
      const run = resolve(options.out, options.run);
      const shots = profiles.flatMap((p) => p.shots.map((s) => s.file));
      copyShotsToBaseline(content, e.id, run, shots);
      const article = updateArticleSteps(content, e);
      console.log(
        `${e.id}: ${shots.length} picture(s) copied to ${content}/media/${e.id}${article ? `, steps block rewritten in ${article}` : ', no article yet'}`,
      );
    }
  }
  const manifest = await writeManifest({ out: options.out, run: options.run, episodes: entries });
  console.log(
    `manifest: ${resolve(options.out, options.run, 'manifest.json')} (${manifest.episodes.length} episodes)`,
  );
  if (values.compare) {
    const prev = JSON.parse(await readFile(resolve(values.compare), 'utf8')) as Manifest;
    failed.push(...compareManifests(prev, manifest));
  }
  if (failed.length) {
    console.error(`Problems:\n${failed.map((f) => `  ${f}`).join('\n')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  if (exitCodeFor(e) === 2)
    console.error(
      'This is an infrastructure problem (stack, browser or reset), not a content failure.',
    );
  process.exit(exitCodeFor(e));
});
