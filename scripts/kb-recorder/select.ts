import type { Episode } from './episode';

/** The seven learning paths of the plan (section 3.1) and the letter their article ids start with. */
export const PATHS: Record<string, string> = {
  start: 'S',
  daily: 'D',
  weekly: 'W',
  setup: 'C',
  money: 'M',
  safety: 'K',
  troubleshooting: 'T',
};

export function pathOf(e: Episode): string | null {
  if (e.path) return e.path;
  const letter = /^([SDWCMKT])\d/.exec(e.id)?.[1];
  return Object.entries(PATHS).find(([, l]) => l === letter)?.[0] ?? null;
}

export function parseEpisodeList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const HARNESS = 'scripts/kb-recorder/';
const EPISODES = `${HARNESS}episodes/`;

const isTest = (f: string) => /\.test\.ts$/.test(f);

/** Whether `file` is `prefix` itself or inside it (so `admin/videos` does not match `admin/videos-archive`). */
const within = (file: string, prefix: string) =>
  file === prefix || file.startsWith(prefix.replace(/\/$/, '') + '/');

/**
 * The episodes a change can affect (`--changed`): those whose `dependsOn` covers a changed file, those whose own file
 * changed, and every episode when the harness itself changed (a helper, the runner, the overlay). Tests do not count.
 */
export function affectedEpisodes(episodes: Episode[], changedFiles: string[]): Episode[] {
  const files = changedFiles.filter((f) => !isTest(f));
  const harnessChanged = files.some((f) => f.startsWith(HARNESS) && !f.startsWith(EPISODES));
  if (harnessChanged) return [...episodes];
  return episodes.filter(
    (e) =>
      files.includes(`${EPISODES}${e.id}.ts`) ||
      (e.dependsOn ?? []).some((prefix) => files.some((f) => within(f, prefix))),
  );
}

export interface Selection {
  episode?: string;
  path?: string;
  changed?: boolean;
  all?: boolean;
}

/** Applies `--episode`, `--path`, `--changed` or `--all`. Exactly one must be given. */
export function selectEpisodes(
  episodes: Episode[],
  sel: Selection,
  changedFiles: string[] = [],
): Episode[] {
  const given = [sel.episode, sel.path, sel.changed || undefined, sel.all || undefined].filter(
    (v) => v !== undefined,
  );
  if (given.length === 0)
    throw new Error('Choose what to record: --episode, --path, --changed or --all');
  if (given.length > 1) throw new Error('Use only one of --episode, --path, --changed and --all');
  if (sel.all) return [...episodes];
  if (sel.changed) return affectedEpisodes(episodes, changedFiles);
  if (sel.path) {
    if (!(sel.path in PATHS))
      throw new Error(`Unknown path "${sel.path}". Paths: ${Object.keys(PATHS).join(', ')}`);
    return episodes.filter((e) => pathOf(e) === sel.path);
  }
  const known = new Map(episodes.map((e) => [e.id, e]));
  return parseEpisodeList(sel.episode!).map((id) => {
    const e = known.get(id);
    if (!e)
      throw new Error(`Unknown episode "${id}". Episodes: ${episodes.map((x) => x.id).join(', ')}`);
    return e;
  });
}
