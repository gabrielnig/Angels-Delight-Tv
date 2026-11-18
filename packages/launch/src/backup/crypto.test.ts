import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decryptBackupFile, encryptBackupFile } from './crypto';

const pair = (bits = 2048) =>
  generateKeyPairSync('rsa', {
    modulusLength: bits,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

async function dir() {
  return mkdtemp(join(tmpdir(), 'ad-backup-crypto-'));
}

describe('backup encryption', () => {
  it('round trips a file and hides the content', async () => {
    const d = await dir();
    const keys = pair();
    const plain = randomBytes(300_000);
    await writeFile(join(d, 'in'), plain);
    await encryptBackupFile(join(d, 'in'), join(d, 'enc'), keys.publicKey);
    const enc = await readFile(join(d, 'enc'));
    expect(enc.subarray(0, 5).toString()).toBe('ADBK1');
    expect(enc.includes(plain.subarray(1000, 1032))).toBe(false);
    await decryptBackupFile(join(d, 'enc'), join(d, 'out'), keys.privateKey);
    expect((await readFile(join(d, 'out'))).equals(plain)).toBe(true);
  });

  it('handles an empty file', async () => {
    const d = await dir();
    const keys = pair();
    await writeFile(join(d, 'in'), '');
    await encryptBackupFile(join(d, 'in'), join(d, 'enc'), keys.publicKey);
    await decryptBackupFile(join(d, 'enc'), join(d, 'out'), keys.privateKey);
    expect((await stat(join(d, 'out'))).size).toBe(0);
  });

  it('uses a fresh key and iv every time, so equal inputs give different files', async () => {
    const d = await dir();
    const keys = pair();
    await writeFile(join(d, 'in'), 'same');
    await encryptBackupFile(join(d, 'in'), join(d, 'a'), keys.publicKey);
    await encryptBackupFile(join(d, 'in'), join(d, 'b'), keys.publicKey);
    expect((await readFile(join(d, 'a'))).equals(await readFile(join(d, 'b')))).toBe(false);
  });

  it('fails with the wrong private key and writes no output', async () => {
    const d = await dir();
    await writeFile(join(d, 'in'), 'secret');
    await encryptBackupFile(join(d, 'in'), join(d, 'enc'), pair().publicKey);
    await expect(
      decryptBackupFile(join(d, 'enc'), join(d, 'out'), pair().privateKey),
    ).rejects.toThrow();
    await expect(stat(join(d, 'out'))).rejects.toThrow();
  });

  it('detects a changed byte and a truncated file', async () => {
    const d = await dir();
    const keys = pair();
    await writeFile(join(d, 'in'), randomBytes(5000));
    await encryptBackupFile(join(d, 'in'), join(d, 'enc'), keys.publicKey);
    const enc = await readFile(join(d, 'enc'));
    const flipped = Buffer.from(enc);
    flipped[flipped.length - 40]! ^= 0xff;
    await writeFile(join(d, 'flipped'), flipped);
    await expect(
      decryptBackupFile(join(d, 'flipped'), join(d, 'o1'), keys.privateKey),
    ).rejects.toThrow(/authenticat|corrupt|tamper/i);
    await writeFile(join(d, 'cut'), enc.subarray(0, enc.length - 100));
    await expect(
      decryptBackupFile(join(d, 'cut'), join(d, 'o2'), keys.privateKey),
    ).rejects.toThrow();
    await expect(stat(join(d, 'o1'))).rejects.toThrow();
  });

  it('rejects a file that is not a backup', async () => {
    const d = await dir();
    await writeFile(join(d, 'x'), 'not a backup at all, just text');
    await expect(
      decryptBackupFile(join(d, 'x'), join(d, 'out'), pair().privateKey),
    ).rejects.toThrow(/not an encrypted backup/i);
  });

  it('accepts the base64 form of the public key stored in the env file', async () => {
    const d = await dir();
    const keys = pair();
    await writeFile(join(d, 'in'), 'abc');
    await encryptBackupFile(
      join(d, 'in'),
      join(d, 'enc'),
      Buffer.from(keys.publicKey).toString('base64'),
    );
    await decryptBackupFile(join(d, 'enc'), join(d, 'out'), keys.privateKey);
    expect((await readFile(join(d, 'out'))).toString()).toBe('abc');
  });
});
