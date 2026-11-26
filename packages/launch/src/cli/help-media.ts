import { resolve } from 'node:path';
import { loadWebEnv } from '@ad/config';
import { createStorage, storageConfigFromEnv } from '@ad/storage';
import { uploadHelpRelease } from '../help-media/upload';
import { parseArgs } from './args';

const USAGE = `Usage: pnpm kb:upload --dir <folder that holds help/<release>/> --release v1 [--dry-run]
In the tools image: ad-tool help-media --dir /content/help-media --release v1
Uploads the help videos to the private originals bucket under help/<release>/ with the server's S3 env.
Safe to run again: files already there with the same size are skipped.`;

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2), {
    values: ['dir', 'release'],
    booleans: ['dry-run'],
  });
  if (!parsed.ok || !parsed.values.dir || !parsed.values.release) {
    console.error(parsed.ok ? 'Both --dir and --release are required' : parsed.error);
    console.error(USAGE);
    return 2;
  }
  const env = loadWebEnv();
  const storage = createStorage(
    storageConfigFromEnv(env, env.BUCKET_ORIGINALS, env.MEDIA_URL_SECRET),
  );
  const dryRun = parsed.flags['dry-run'] ?? false;
  const result = await uploadHelpRelease({
    root: resolve(parsed.values.dir),
    release: parsed.values.release,
    storage,
    dryRun,
    onFile: (item, state) =>
      console.log(
        `${state === 'uploaded' ? (dryRun ? 'would upload' : 'uploaded') : 'same'}  ${item.key}`,
      ),
  });
  console.log(
    `${dryRun ? 'Dry run: ' : ''}${result.uploaded} uploaded, ${result.skipped} already there. Next: set HELP_MEDIA_RELEASE=${parsed.values.release} and restart web.`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
