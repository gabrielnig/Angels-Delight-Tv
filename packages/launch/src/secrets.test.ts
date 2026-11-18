import { generateKeyPairSync, privateDecrypt, publicEncrypt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  GENERATED_SECRET_NAMES,
  generateSecretValues,
  generateBackupKeypair,
  mergeSecrets,
} from './secrets';

describe('generateSecretValues', () => {
  it('makes distinct 32 byte base64 keys and url safe passwords', () => {
    const values = generateSecretValues();
    const keys = [
      'FIELD_KEK',
      'EMAIL_HASH_PEPPER',
      'HLS_KEK',
      'PLAYBACK_TOKEN_SECRET',
      'MEDIA_URL_SECRET',
    ];
    for (const name of keys) expect(Buffer.from(values[name]!, 'base64')).toHaveLength(32);
    expect(new Set(keys.map((name) => values[name])).size).toBe(keys.length);
    for (const name of ['POSTGRES_PASSWORD', 'DB_ROLE_PASSWORD']) {
      expect(values[name]).toMatch(/^[A-Za-z0-9_-]{32}$/);
    }
    expect(Object.keys(values).sort()).toEqual([...GENERATED_SECRET_NAMES].sort());
  });

  it('is different every call', () => {
    expect(generateSecretValues().FIELD_KEK).not.toBe(generateSecretValues().FIELD_KEK);
  });
});

describe('mergeSecrets', () => {
  const template = ['# header', 'FIELD_KEK=', 'HLS_KEK=existing', 'APP_DOMAIN=x', ''].join('\n');

  it('fills empty secrets and keeps ones already set', () => {
    const { text, set, kept } = mergeSecrets(
      template,
      { FIELD_KEK: 'new1', HLS_KEK: 'new2' },
      { force: false },
    );
    expect(text).toContain('FIELD_KEK=new1');
    expect(text).toContain('HLS_KEK=existing');
    expect(set).toEqual(['FIELD_KEK']);
    expect(kept).toEqual(['HLS_KEK']);
  });

  it('overwrites with force', () => {
    const { text, set } = mergeSecrets(template, { HLS_KEK: 'new2' }, { force: true });
    expect(text).toContain('HLS_KEK=new2');
    expect(set).toEqual(['HLS_KEK']);
  });

  it('a second run changes nothing', () => {
    const first = mergeSecrets(template, { FIELD_KEK: 'a', HLS_KEK: 'b' }, { force: false });
    const second = mergeSecrets(first.text, { FIELD_KEK: 'c', HLS_KEK: 'd' }, { force: false });
    expect(second.text).toBe(first.text);
    expect(second.set).toEqual([]);
  });
});

describe('generateBackupKeypair', () => {
  it('returns a public key that the private key can decrypt with', () => {
    const pair = generateBackupKeypair(2048);
    const sealed = publicEncrypt(
      { key: Buffer.from(pair.publicKeyB64, 'base64').toString('utf8'), oaepHash: 'sha256' },
      Buffer.from('hello'),
    );
    expect(privateDecrypt({ key: pair.privateKeyPem, oaepHash: 'sha256' }, sealed).toString()).toBe(
      'hello',
    );
    expect(pair.privateKeyPem).toContain('PRIVATE KEY');
    expect(generateKeyPairSync).toBeTypeOf('function');
  });
});
