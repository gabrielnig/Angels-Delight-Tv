/** The manifest the platform reads to list videos and pictures (schema 1). All paths are relative to the manifest. */

export interface ManifestShot {
  step: number;
  file: string;
  alt: string;
  bytes: number;
}

export interface ManifestProfile {
  profile: 'desktop' | 'mobile';
  /** The main video (720p on desktop, 390 by 844 on phones). */
  video: string;
  /** Every size of the video, the main one included. */
  renditions: Array<{ height: number; file: string; bytes: number }>;
  vtt: string;
  transcript: string;
  chapters: string;
  poster: string;
  width: number;
  height: number;
  bytes: number;
  durationMs: number;
  shots: ManifestShot[];
}

export interface ManifestEpisode {
  id: string;
  title: string;
  role: string;
  path: string | null;
  locale: string;
  profiles: ManifestProfile[];
}

export interface Manifest {
  schema: 1;
  run: string;
  generatedAt: string;
  episodes: ManifestEpisode[];
}

const ABSOLUTE = /^(?:\/|[A-Za-z]:|\\)/;

function pathsOf(p: ManifestProfile): string[] {
  return [
    p.video,
    p.vtt,
    p.transcript,
    p.chapters,
    p.poster,
    ...p.renditions.map((r) => r.file),
    ...p.shots.map((s) => s.file),
  ];
}

export function buildManifest(o: {
  run: string;
  generatedAt: string;
  episodes: ManifestEpisode[];
}): Manifest {
  for (const e of o.episodes) {
    for (const p of e.profiles) {
      for (const f of pathsOf(p)) {
        if (ABSOLUTE.test(f) || f.includes('\\')) {
          throw new Error(`Manifest path "${f}" in ${e.id} must be relative with forward slashes`);
        }
      }
    }
  }
  return {
    schema: 1,
    run: o.run,
    generatedAt: o.generatedAt,
    episodes: [...o.episodes].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/**
 * Compares two runs (nightly): an episode or profile that went missing, or a duration that moved by more than the
 * tolerance (10 percent by default). A new episode is fine.
 */
export function compareManifests(prev: Manifest, next: Manifest, tolerance = 0.1): string[] {
  const out: string[] = [];
  const now = new Map(next.episodes.map((e) => [e.id, e]));
  for (const e of prev.episodes) {
    const n = now.get(e.id);
    if (!n) {
      out.push(`${e.id} is missing from the new run`);
      continue;
    }
    for (const p of e.profiles) {
      const q = n.profiles.find((x) => x.profile === p.profile);
      if (!q) {
        out.push(`${e.id} ${p.profile} is missing from the new run`);
        continue;
      }
      const change = Math.abs(q.durationMs - p.durationMs) / p.durationMs;
      if (change > tolerance) {
        out.push(
          `${e.id} ${p.profile} changed length by ${Math.round(change * 100)} percent (${Math.round(p.durationMs / 1000)} s to ${Math.round(q.durationMs / 1000)} s)`,
        );
      }
    }
  }
  return out;
}
