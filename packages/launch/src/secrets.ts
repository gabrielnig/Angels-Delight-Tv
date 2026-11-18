import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { updateEnvText } from './env-file';

/** Secrets the generator fills in. Base64 keys are 32 random bytes (the loaders in @ad/config check this). */
export const GENERATED_SECRET_NAMES = [
  'FIELD_KEK',
  'EMAIL_HASH_PEPPER',
  'HLS_KEK',
  'PLAYBACK_TOKEN_SECRET',
  'MEDIA_URL_SECRET',
  'POSTGRES_PASSWORD',
  'DB_ROLE_PASSWORD',
] as const;

const BASE64_KEYS = [
  'FIELD_KEK',
  'EMAIL_HASH_PEPPER',
  'HLS_KEK',
  'PLAYBACK_TOKEN_SECRET',
  'MEDIA_URL_SECRET',
];

export function generateSecretValues(
  random: (size: number) => Buffer = randomBytes,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of BASE64_KEYS) values[name] = random(32).toString('base64');
  for (const name of ['POSTGRES_PASSWORD', 'DB_ROLE_PASSWORD']) {
    values[name] = random(24).toString('base64url').slice(0, 32);
  }
  return values;
}

export interface MergeResult {
  text: string;
  set: string[];
  kept: string[];
}

/** Puts generated values into env text. A value that is already set is kept unless `force`, so a rerun is safe. */
export function mergeSecrets(
  text: string,
  values: Record<string, string>,
  options: { force: boolean },
): MergeResult {
  const toSet: Record<string, string> = {};
  const kept: string[] = [];
  for (const [name, value] of Object.entries(values)) {
    const existing = new RegExp(`^${name}=(.+)$`, 'm').exec(text)?.[1];
    if (existing && !options.force) kept.push(name);
    else toSet[name] = value;
  }
  const result = updateEnvText(text, toSet);
  return { text: result.text, set: result.changes.map((change) => change.name), kept };
}

export interface BackupKeypair {
  /** Base64 of the PEM, one line, for the env file. */
  publicKeyB64: string;
  /** Goes to the owner's offline storage and never to the server. */
  privateKeyPem: string;
}

export function generateBackupKeypair(modulusLength = 4096): BackupKeypair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKeyB64: Buffer.from(publicKey).toString('base64'), privateKeyPem: privateKey };
}
