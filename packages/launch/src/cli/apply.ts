import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { emailHash, findAccountByEmailHash, normalizeEmail } from '@ad/auth';
import { ConfigError } from '@ad/config';
import { createLogger, type Actor } from '@ad/shared';
import {
  LogoUploader,
  SettingsService,
  ThemeService,
  createDrizzleAssetStore,
  createDrizzleSettingsStore,
  createDrizzleThemeStore,
} from '@ad/theme';
import { applyClientConfig } from '../apply';
import { parseClientConfig } from '../client-config';
import { formatApplyReport } from '../report';
import { createToolsRuntime } from '../runtime';
import { parseArgs } from './args';

const USAGE = `Usage: pnpm launch:apply --config client.json [--dry-run] [--env-file .env.production]
                          [--icons-dir /data/brand] [--accept-warnings] [--json]`;

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2), {
    values: ['config', 'env-file', 'icons-dir'],
    booleans: ['dry-run', 'accept-warnings', 'json'],
  });
  if (!parsed.ok || !parsed.values.config) {
    console.error(parsed.ok ? 'Missing --config' : parsed.error);
    console.error(USAGE);
    return 2;
  }
  const configPath = resolve(parsed.values.config);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(configPath, 'utf8'));
  } catch {
    console.error(`Cannot read ${configPath} as JSON`);
    return 2;
  }
  const config = parseClientConfig(raw);
  if (!config.ok) {
    console.error('The config file has problems:');
    for (const problem of config.errors)
      console.error(`  ${problem.path || '(file)'}: ${problem.message}`);
    return 2;
  }

  let runtime;
  try {
    runtime = createToolsRuntime('launch-apply');
  } catch (error) {
    console.error(error instanceof ConfigError ? error.message : 'Cannot load the environment');
    return 2;
  }
  try {
    const email = normalizeEmail(config.config.adminOwnerEmail);
    const found = email
      ? await findAccountByEmailHash(runtime.db, emailHash(email, runtime.env.EMAIL_HASH_PEPPER))
      : null;
    if (!found || found.role !== 'admin' || found.status !== 'active') {
      console.error(
        'No active admin account has the adminOwnerEmail. Create it first with `pnpm db:seed:admin`, then run this again.',
      );
      return 1;
    }
    const actor: Actor = { accountId: found.id, role: 'admin' };
    const logger = createLogger({ level: 'warn', bindings: { tool: 'launch-apply' } });
    const report = await applyClientConfig(
      config.config,
      {
        settings: new SettingsService({ store: createDrizzleSettingsStore(runtime.db), logger }),
        theme: new ThemeService({ store: createDrizzleThemeStore(runtime.db), logger }),
        logos: new LogoUploader({
          storage: runtime.media,
          assets: createDrizzleAssetStore(runtime.db),
        }),
        actor,
        baseDir: dirname(configPath),
        iconsDir: parsed.values['icons-dir'] ?? process.env.PWA_ICONS_DIR,
        envFile: parsed.values['env-file'],
      },
      { dryRun: parsed.flags['dry-run']!, acceptWarnings: parsed.flags['accept-warnings'] },
    );
    console.log(parsed.flags.json ? JSON.stringify(report, null, 2) : formatApplyReport(report));
    return report.ok ? 0 : 1;
  } finally {
    await runtime.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error('launch:apply failed:', error instanceof Error ? error.message : 'unknown error');
    process.exit(1);
  },
);
