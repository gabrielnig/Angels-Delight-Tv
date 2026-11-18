import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { z } from 'zod';
import type { BackupTarget } from './retention';

export const MANIFEST_SUFFIX = '.manifest.json';

/** `db/ad-20261118T023005Z.dump.enc.manifest.json`: sits next to the backup it describes. */
export function manifestKey(backupKey: string): string {
  return `${backupKey}${MANIFEST_SUFFIX}`;
}

const manifestSchema = z.strictObject({
  version: z.literal(1),
  key: z.string().min(1),
  target: z.enum(['db', 'keys']),
  takenAt: z.iso.datetime(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export type BackupManifest = z.infer<typeof manifestSchema>;

export function buildManifest(input: {
  key: string;
  target: BackupTarget;
  takenAt: Date;
  bytes: number;
  sha256: string;
}): BackupManifest {
  return {
    version: 1,
    key: input.key,
    target: input.target,
    takenAt: input.takenAt.toISOString(),
    bytes: input.bytes,
    sha256: input.sha256,
  };
}

export function parseManifest(text: string): BackupManifest | null {
  try {
    const result = manifestSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function fileSha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
