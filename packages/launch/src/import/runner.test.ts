import { describe, expect, it } from 'vitest';
import type { ManifestRow } from './manifest';
import { runImport, settlePosters, type ImportPorts } from './runner';

function row(file: string, extra: Partial<ManifestRow> = {}): ManifestRow {
  return {
    line: 2,
    file,
    title: file,
    description: '',
    categories: [],
    series: null,
    season: null,
    episode: null,
    suitability: null,
    language: 'en',
    script: null,
    poster: null,
    ...extra,
  };
}

class FakePorts implements ImportPorts {
  hashes = new Map<string, string>();
  imported = new Map<string, { videoId: string; complete: boolean }>();
  imports: string[] = [];
  posters: string[] = [];
  failOn = new Set<string>();
  resumable = new Set<string>();
  next = 1;

  async hash(path: string) {
    return this.hashes.get(path) ?? `sha-${path}`;
  }
  async findImported(sha: string) {
    return this.imported.get(sha) ?? null;
  }
  async importFile(
    file: ManifestRow,
    sha: string,
    onProgress: (done: number, total: number) => void,
  ) {
    if (this.failOn.has(file.file)) throw new Error('storage unavailable');
    onProgress(1, 2);
    onProgress(2, 2);
    const existing = this.imported.get(sha);
    const videoId = existing?.videoId ?? `video-${this.next++}`;
    this.imported.set(sha, { videoId, complete: true });
    this.imports.push(file.file);
    return { videoId, resumed: this.resumable.has(file.file) };
  }
  async attachPoster(file: ManifestRow, videoId: string) {
    if (!file.poster) return 'none' as const;
    this.posters.push(`${videoId}:${file.poster}`);
    return 'attached' as const;
  }
}

describe('runImport', () => {
  it('imports new files and reports each one with progress', async () => {
    const ports = new FakePorts();
    const events: string[] = [];
    const report = await runImport([row('a.mp4'), row('b.mp4')], ports, {
      dryRun: false,
      onEvent: (event) => events.push(`${event.type}:${event.file}`),
    });
    expect(report.results.map((r) => r.status)).toEqual(['imported', 'imported']);
    expect(report.ok).toBe(true);
    expect(ports.imports).toEqual(['a.mp4', 'b.mp4']);
    expect(events).toContain('progress:a.mp4');
    expect(events).toContain('done:b.mp4');
  });

  it('is idempotent: a second run skips everything already imported by checksum', async () => {
    const ports = new FakePorts();
    await runImport([row('a.mp4'), row('b.mp4')], ports, { dryRun: false });
    ports.imports = [];
    const again = await runImport([row('a.mp4'), row('b.mp4')], ports, { dryRun: false });
    expect(again.results.map((r) => r.status)).toEqual(['skipped', 'skipped']);
    expect(ports.imports).toEqual([]);
  });

  it('skips a renamed file with the same content', async () => {
    const ports = new FakePorts();
    ports.hashes.set('renamed.mp4', 'sha-a.mp4');
    await runImport([row('a.mp4')], ports, { dryRun: false });
    const report = await runImport([row('renamed.mp4')], ports, { dryRun: false });
    expect(report.results[0]).toMatchObject({ status: 'skipped', videoId: 'video-1' });
  });

  it('imports a file whose earlier upload did not finish, and says it resumed', async () => {
    const ports = new FakePorts();
    ports.imported.set('sha-a.mp4', { videoId: 'video-9', complete: false });
    ports.resumable.add('a.mp4');
    const report = await runImport([row('a.mp4')], ports, { dryRun: false });
    expect(report.results[0]).toMatchObject({ status: 'resumed', videoId: 'video-9' });
  });

  it('keeps going after a failure and reports not ok', async () => {
    const ports = new FakePorts();
    ports.failOn.add('a.mp4');
    const report = await runImport([row('a.mp4'), row('b.mp4')], ports, { dryRun: false });
    expect(report.results.map((r) => r.status)).toEqual(['failed', 'imported']);
    expect(report.results[0]!.message).toBe('storage unavailable');
    expect(report.ok).toBe(false);
  });

  it('dry run writes nothing and says what would happen', async () => {
    const ports = new FakePorts();
    await runImport([row('a.mp4')], ports, { dryRun: false });
    ports.imports = [];
    const report = await runImport([row('a.mp4'), row('b.mp4', { poster: 'p.jpg' })], ports, {
      dryRun: true,
    });
    expect(report.results.map((r) => r.status)).toEqual(['would_skip', 'would_import']);
    expect(ports.imports).toEqual([]);
    expect(ports.posters).toEqual([]);
  });

  it('treats two rows with the same content as one video', async () => {
    const ports = new FakePorts();
    ports.hashes.set('copy.mp4', 'sha-a.mp4');
    const dry = await runImport([row('a.mp4'), row('copy.mp4')], ports, { dryRun: true });
    expect(dry.results.map((r) => r.status)).toEqual(['would_import', 'would_skip']);
    const real = await runImport([row('a.mp4'), row('copy.mp4')], ports, { dryRun: false });
    expect(real.results.map((r) => r.status)).toEqual(['imported', 'skipped']);
  });

  it('attaches posters for new and already imported files', async () => {
    const ports = new FakePorts();
    await runImport([row('a.mp4')], ports, { dryRun: false });
    const report = await runImport([row('a.mp4', { poster: 'p.jpg' })], ports, { dryRun: false });
    expect(report.results[0]).toMatchObject({ status: 'skipped', poster: 'attached' });
    expect(ports.posters).toEqual(['video-1:p.jpg']);
  });

  it('counts the outcomes', async () => {
    const ports = new FakePorts();
    ports.failOn.add('c.mp4');
    await runImport([row('a.mp4')], ports, { dryRun: false });
    const report = await runImport([row('a.mp4'), row('b.mp4'), row('c.mp4')], ports, {
      dryRun: false,
    });
    expect(report.counts).toMatchObject({ skipped: 1, imported: 1, failed: 1 });
  });
});

describe('settlePosters', () => {
  it('polls pending posters until they attach or the time runs out', async () => {
    const calls: number[] = [];
    const ports = {
      attachPoster: async () => {
        calls.push(1);
        return calls.length >= 3 ? ('attached' as const) : ('pending' as const);
      },
    };
    const rows = [row('a.mp4', { poster: 'p.jpg' })];
    const report = {
      ok: true,
      dryRun: false,
      counts: {} as never,
      results: [
        {
          line: 2,
          file: 'a.mp4',
          status: 'imported' as const,
          videoId: 'v1',
          poster: 'pending' as const,
        },
      ],
    };
    let now = 0;
    await settlePosters(report, rows, ports, {
      timeoutMs: 60_000,
      intervalMs: 5_000,
      sleep: async (ms) => {
        now += ms;
      },
      now: () => now,
    });
    expect(report.results[0]!.poster).toBe('attached');
    expect(calls).toHaveLength(3);
  });

  it('gives up after the timeout and leaves the poster pending', async () => {
    let now = 0;
    const ports = { attachPoster: async () => 'pending' as const };
    const report = {
      ok: true,
      dryRun: false,
      counts: {} as never,
      results: [
        {
          line: 2,
          file: 'a.mp4',
          status: 'imported' as const,
          videoId: 'v1',
          poster: 'pending' as const,
        },
      ],
    };
    await settlePosters(report, [row('a.mp4', { poster: 'p.jpg' })], ports, {
      timeoutMs: 10_000,
      intervalMs: 5_000,
      sleep: async (ms) => {
        now += ms;
      },
      now: () => now,
    });
    expect(report.results[0]!.poster).toBe('pending');
  });
});
