import { schema, type Database } from '@ad/db';
import { decryptAesGcm, encryptAesGcm } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

export class KeyUnavailable extends Error {
  constructor() {
    super('No encryption key for this account');
    this.name = 'KeyUnavailable';
  }
}

export interface KeyServiceOptions {
  /** Connection to the separate ad_keys database as ad_keys_app (select and insert). */
  keysDb: Database;
  /** Connection as ad_keys_shred (delete only). Absent in processes that must never destroy keys. */
  shredDb?: Database;
  kek: Uint8Array;
  kekPrevious?: Uint8Array;
  kekVersion?: number;
  cacheTtlMs?: number;
  cacheMax?: number;
  clock?: () => number;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Per account data keys for crypto shredding (SECURITY.md section 10). Each key is wrapped with FIELD_KEK and
 * stored in the keys database. Unwrapped keys sit in a small in-memory cache for at most five minutes.
 */
export class KeyService {
  private readonly cache = new Map<string, { dek: Uint8Array; expires: number }>();
  private readonly ttl: number;
  private readonly max: number;
  private readonly clock: () => number;

  constructor(private readonly options: KeyServiceOptions) {
    this.ttl = options.cacheTtlMs ?? 5 * 60_000;
    this.max = options.cacheMax ?? 1000;
    this.clock = options.clock ?? Date.now;
  }

  async createForAccount(accountId: string): Promise<Uint8Array> {
    const dek = new Uint8Array(randomBytes(32));
    const wrapped = encryptAesGcm(this.options.kek, dek, enc.encode(`dek:${accountId}`));
    await this.options.keysDb.insert(schema.userKeys).values({
      accountId,
      dekWrapped: Buffer.from(wrapped),
      kekVersion: this.options.kekVersion ?? 1,
    });
    this.remember(accountId, dek);
    return dek;
  }

  async get(accountId: string): Promise<Uint8Array> {
    const hit = this.cache.get(accountId);
    if (hit && hit.expires > this.clock()) return hit.dek;
    this.cache.delete(accountId);
    const [row] = await this.options.keysDb
      .select({ wrapped: schema.userKeys.dekWrapped })
      .from(schema.userKeys)
      .where(eq(schema.userKeys.accountId, accountId));
    if (!row) throw new KeyUnavailable();
    const dek = this.unwrap(accountId, new Uint8Array(row.wrapped));
    this.remember(accountId, dek);
    return dek;
  }

  async seal(accountId: string, column: string, plaintext: string): Promise<Buffer> {
    const dek = await this.get(accountId);
    return Buffer.from(encryptAesGcm(dek, enc.encode(plaintext), enc.encode(`${accountId}:${column}`)));
  }

  async open(accountId: string, column: string, sealed: Uint8Array): Promise<string> {
    const dek = await this.get(accountId);
    return dec.decode(decryptAesGcm(dek, new Uint8Array(sealed), enc.encode(`${accountId}:${column}`)));
  }

  /** The crypto shredding step. Returns false when there was no key left, so a retry is harmless. */
  async destroy(accountId: string): Promise<boolean> {
    if (!this.options.shredDb) throw new Error('This process has no shred connection');
    this.cache.delete(accountId);
    const deleted = await this.options.shredDb
      .delete(schema.userKeys)
      .where(eq(schema.userKeys.accountId, accountId))
      .returning({ accountId: schema.userKeys.accountId });
    return deleted.length > 0;
  }

  private unwrap(accountId: string, wrapped: Uint8Array): Uint8Array {
    const aad = enc.encode(`dek:${accountId}`);
    try {
      return decryptAesGcm(this.options.kek, wrapped, aad);
    } catch (error) {
      if (!this.options.kekPrevious) throw error;
      return decryptAesGcm(this.options.kekPrevious, wrapped, aad);
    }
  }

  private remember(accountId: string, dek: Uint8Array): void {
    if (this.cache.size >= this.max) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(accountId, { dek, expires: this.clock() + this.ttl });
  }
}
