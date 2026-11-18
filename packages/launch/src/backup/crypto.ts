import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, rm, stat, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * Backup file format (D-102): hybrid public key encryption so the server holds only the public key.
 *   "ADBK1" | wrapped key length (uint16 BE) | RSA-OAEP(SHA-256) wrapped AES-256 key | 12 byte iv | AES-256-GCM ciphertext | 16 byte tag
 * Every file gets a fresh key and iv. The private key stays offline with the owner.
 */
const MAGIC = Buffer.from('ADBK1');
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Accepts a PEM, or the base64 of a PEM as stored in the env file. */
function normalisePem(key: string): string {
  const trimmed = key.trim();
  return trimmed.startsWith('-----') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
}

export async function encryptBackupFile(
  input: string,
  output: string,
  publicKey: string,
): Promise<void> {
  const key = createPublicKey(normalisePem(publicKey));
  const dataKey = randomBytes(32);
  const iv = randomBytes(IV_BYTES);
  const wrapped = publicEncrypt(
    { key, oaepHash: 'sha256', padding: constants.RSA_PKCS1_OAEP_PADDING },
    dataKey,
  );
  const header = Buffer.concat([
    MAGIC,
    Buffer.from([wrapped.length >> 8, wrapped.length & 0xff]),
    wrapped,
    iv,
  ]);
  await writeFile(output, header, { mode: 0o600 });
  const cipher = createCipheriv('aes-256-gcm', dataKey, iv, { authTagLength: TAG_BYTES });
  try {
    await pipeline(
      createReadStream(input),
      cipher,
      createWriteStream(output, { flags: 'a', mode: 0o600 }),
    );
    const out = createWriteStream(output, { flags: 'a' });
    await new Promise<void>((resolve, reject) => {
      out.on('error', reject);
      out.end(cipher.getAuthTag(), resolve);
    });
  } catch (error) {
    await rm(output, { force: true });
    throw error;
  }
}

export async function decryptBackupFile(
  input: string,
  output: string,
  privateKey: string,
): Promise<void> {
  const { size } = await stat(input);
  const handle = await open(input, 'r');
  let header: Buffer;
  let wrappedLength: number;
  try {
    const start = Buffer.alloc(MAGIC.length + 2);
    const { bytesRead } = await handle.read(start, 0, start.length, 0);
    if (bytesRead < start.length || !start.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('This is not an encrypted backup file');
    }
    wrappedLength = (start[MAGIC.length]! << 8) | start[MAGIC.length + 1]!;
    header = Buffer.alloc(MAGIC.length + 2 + wrappedLength + IV_BYTES);
    await handle.read(header, 0, header.length, 0);
    if (size < header.length + TAG_BYTES) throw new Error('The backup file is truncated');
  } finally {
    await handle.close();
  }
  const wrapped = header.subarray(MAGIC.length + 2, MAGIC.length + 2 + wrappedLength);
  const iv = header.subarray(header.length - IV_BYTES);
  const tagHandle = await open(input, 'r');
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    await tagHandle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
  } finally {
    await tagHandle.close();
  }
  let dataKey: Buffer;
  try {
    dataKey = privateDecrypt(
      {
        key: normalisePem(privateKey),
        oaepHash: 'sha256',
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      wrapped,
    );
  } catch {
    throw new Error('This private key does not open this backup');
  }
  const decipher = createDecipheriv('aes-256-gcm', dataKey, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  try {
    await pipeline(
      size - TAG_BYTES === header.length
        ? Readable.from([])
        : createReadStream(input, { start: header.length, end: size - TAG_BYTES - 1 }),
      decipher,
      createWriteStream(output, { mode: 0o600 }),
    );
  } catch {
    await rm(output, { force: true });
    throw new Error('The backup failed authentication: it is corrupt or was tampered with');
  }
}
