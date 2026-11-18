import { existsSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { ConfigError } from '@ad/config';
import { DrizzleJobMirror, JobProducer, bossAdapter, createProducerBoss } from '@ad/queue';
import { createLogger } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { UploadService } from '@ad/video';
import { parseManifestText, validateManifest } from '../import/manifest';
import { runImport, settlePosters, type ImportEvent } from '../import/runner';
import { ServiceImportPorts, httpPartWriter, localPartWriter } from '../import/service-ports';
import { formatImportReport } from '../report';
import { createToolsRuntime, resolveAdminActor } from '../runtime';
import { parseArgs } from './args';

const USAGE = `Usage: pnpm content:import --dir videos/ --manifest videos.csv --admin-email owner@example.org
                          [--dry-run] [--wait-posters 90] [--json]
The manifest is CSV or JSON. Columns: file, title, description, category, series, season, episode, age_rating,
language, script, poster. Paths are relative to --dir. Safe to run again: finished files are skipped.`;

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2), {
    values: ['dir', 'manifest', 'admin-email', 'wait-posters'],
    booleans: ['dry-run', 'json'],
  });
  if (!parsed.ok || !parsed.values.dir || !parsed.values.manifest) {
    console.error(parsed.ok ? 'Both --dir and --manifest are required' : parsed.error);
    console.error(USAGE);
    return 2;
  }
  const dir = resolve(parsed.values.dir);
  if (!existsSync(dir)) {
    console.error(`The folder ${dir} does not exist`);
    return 2;
  }
  let manifestPath = resolve(parsed.values.manifest);
  if (!existsSync(manifestPath) && existsSync(join(dir, parsed.values.manifest))) {
    manifestPath = join(dir, parsed.values.manifest);
  }
  let text: string;
  try {
    text = await readFile(manifestPath, 'utf8');
  } catch {
    console.error(`Cannot read the manifest ${manifestPath}`);
    return 2;
  }
  const format = manifestPath.toLowerCase().endsWith('.json') ? 'json' : 'csv';
  const raw = parseManifestText(text, format);
  if (!raw.ok) {
    console.error(`The manifest has a problem: ${raw.error}`);
    return 2;
  }
  if (raw.rows.length === 0) {
    console.error('The manifest has no rows');
    return 2;
  }

  // Validate everything first. Nothing is imported while any row has a problem.
  const { rows, errors } = await validateManifest(raw.rows, {
    exists: (path) =>
      access(isAbsolute(path) ? path : join(dir, path)).then(
        () => true,
        () => false,
      ),
  });
  if (errors.length > 0) {
    console.error(`The manifest has ${errors.length} problem(s). Nothing was imported.`);
    for (const problem of errors)
      console.error(`  line ${problem.line}, ${problem.field}: ${problem.message}`);
    return 2;
  }
  console.error(`Manifest OK: ${rows.length} file(s).`);

  const adminEmail = parsed.values['admin-email'] ?? process.env.IMPORT_ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('Give --admin-email (an existing admin) or set IMPORT_ADMIN_EMAIL');
    return 2;
  }
  const waitSeconds = Number(parsed.values['wait-posters'] ?? 90);
  if (!Number.isFinite(waitSeconds) || waitSeconds < 0) {
    console.error('--wait-posters must be a number of seconds, 0 or more');
    return 2;
  }

  let runtime;
  try {
    runtime = createToolsRuntime('content-import');
  } catch (error) {
    console.error(error instanceof ConfigError ? error.message : 'Cannot load the environment');
    return 2;
  }
  const dryRun = parsed.flags['dry-run']!;
  let boss: Awaited<ReturnType<typeof createProducerBoss>> | undefined;
  try {
    const actor = await resolveAdminActor(runtime, adminEmail);
    if (!actor) {
      console.error(
        'No active admin account has that email. Create it first with `pnpm db:seed:admin`.',
      );
      return 1;
    }
    const logger = createLogger({ level: 'warn', bindings: { tool: 'content-import' } });
    boss = await createProducerBoss({
      connectionString: runtime.env.DATABASE_URL,
      onError: (error: Error) => logger.error('queue error', { err: error }),
    });
    const producer = new JobProducer({
      boss: bossAdapter(boss),
      mirror: new DrizzleJobMirror(runtime.db),
    });
    const upload = new UploadService({
      db: runtime.db,
      originals: runtime.originals,
      media: runtime.media,
      producer,
      limits: { maxBytes: runtime.env.MAX_UPLOAD_BYTES, partBytes: runtime.env.UPLOAD_PART_BYTES },
      logger,
    });
    const writePart =
      runtime.originals instanceof LocalStorage
        ? localPartWriter(runtime.originals, runtime.env.MEDIA_URL_SECRET)
        : httpPartWriter;
    const ports = new ServiceImportPorts({
      db: runtime.db,
      actor,
      dir,
      ctx: { db: runtime.db },
      upload,
      originals: runtime.originals,
      producer,
      writePart,
    });

    let lastTick = 0;
    const onEvent = (event: ImportEvent) => {
      if (parsed.flags.json) return;
      if (event.type === 'start') console.error(`[${event.index}/${event.total}] ${event.file}`);
      else if (event.type === 'progress' && Date.now() - lastTick > 2000) {
        lastTick = Date.now();
        console.error(`    part ${event.done}/${event.total}`);
      } else if (event.type === 'done') {
        console.error(
          `    ${event.result.status.replace('_', ' ')}${event.result.message ? `: ${event.result.message}` : ''}`,
        );
      }
    };
    const report = await runImport(rows, ports, { dryRun, onEvent });
    if (!dryRun && waitSeconds > 0) {
      await settlePosters(report, rows, ports, { timeoutMs: waitSeconds * 1000, intervalMs: 5000 });
    }
    console.log(parsed.flags.json ? JSON.stringify(report, null, 2) : formatImportReport(report));
    return report.ok ? 0 : 1;
  } finally {
    await boss?.stop({ graceful: true, timeout: 5000 }).catch(() => undefined);
    await runtime.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(
      'content:import failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    process.exit(1);
  },
);
