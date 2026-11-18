import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { generateBackupKeypair, generateSecretValues, mergeSecrets } from '../secrets';
import { parseArgs } from './args';

const USAGE = `Usage: pnpm secrets:generate [--env-file .env.production] [--template .env.production.example]
                             [--keypair-dir ./offline-keys] [--force]
Creates the env file from the template when it is missing, fills every empty secret with fresh random values, and
generates the two backup keypairs. Values already set are kept unless --force. Secret values are never printed.`;

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2), {
    values: ['env-file', 'template', 'keypair-dir'],
    booleans: ['force'],
  });
  if (!parsed.ok) {
    console.error(parsed.error);
    console.error(USAGE);
    return 2;
  }
  const envFile = resolve(parsed.values['env-file'] ?? '.env.production');
  const template = resolve(parsed.values.template ?? '.env.production.example');
  const keypairDir = resolve(parsed.values['keypair-dir'] ?? 'offline-keys');
  const force = parsed.flags.force!;

  let text: string;
  if (existsSync(envFile)) text = await readFile(envFile, 'utf8');
  else if (existsSync(template)) text = await readFile(template, 'utf8');
  else {
    console.error(`Neither ${envFile} nor ${template} exists`);
    return 1;
  }

  const values = generateSecretValues();
  const merged = mergeSecrets(text, values, { force });
  text = merged.text;
  const written = [...merged.set];

  // Backup keypairs: public halves go to the env file, private halves to a folder the owner moves offline.
  const keypairs = [
    { env: 'BACKUP_PUBLIC_KEY_DB_B64', file: 'backup-db-private.pem' },
    { env: 'BACKUP_PUBLIC_KEY_KEYS_B64', file: 'backup-keys-private.pem' },
  ];
  const created: string[] = [];
  for (const { env, file } of keypairs) {
    const already = new RegExp(`^${env}=(.+)$`, 'm').test(text);
    if (already && !force) continue;
    const pair = generateBackupKeypair();
    await mkdir(keypairDir, { recursive: true, mode: 0o700 });
    const target = join(keypairDir, file);
    if (existsSync(target) && !force) {
      console.error(`${target} exists but ${env} is empty. Move it away or use --force.`);
      return 1;
    }
    await writeFile(target, pair.privateKeyPem, { mode: 0o600 });
    await chmod(target, 0o600);
    const next = mergeSecrets(text, { [env]: pair.publicKeyB64 }, { force: true });
    text = next.text;
    written.push(env);
    created.push(target);
  }

  await writeFile(envFile, text, { mode: 0o600 });
  await chmod(envFile, 0o600);
  console.log(`Wrote ${envFile} (mode 600)`);
  console.log(`Set: ${written.length ? written.join(', ') : 'nothing new'}`);
  if (merged.kept.length) console.log(`Kept existing: ${merged.kept.join(', ')}`);
  if (created.length) {
    console.log('');
    console.log('Backup private keys written:');
    for (const file of created) console.log(`  ${file}`);
    console.log(
      'Copy these to the owner password manager or an offline drive NOW, then delete them from this machine.',
    );
    console.log('They must never be on the server. Without them backups cannot be restored.');
  }
  console.log('');
  console.log('Also store FIELD_KEK and HLS_KEK offline. Losing them cannot be recovered.');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(
      'secrets:generate failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    process.exit(1);
  },
);
