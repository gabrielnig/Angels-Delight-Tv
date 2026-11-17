import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

/** The library's Algorithm enum is a const enum, which the build setting verbatimModuleSyntax cannot import. 2 is Argon2id. */
const ARGON2ID = 2;
import { PASSWORD_MAX_LENGTH } from './policy';

export interface HashParams {
  memoryKib: number;
  timeCost: number;
  parallelism: number;
}

/** SECURITY.md section 4 starting values. Tune on the production VPS to roughly 100 to 250 ms. */
export const DEFAULT_HASH_PARAMS: HashParams = { memoryKib: 19456, timeCost: 2, parallelism: 1 };

export interface HashEngine {
  hash(password: string, params: HashParams): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

const argon2Engine: HashEngine = {
  hash: (password, params) =>
    argonHash(password, {
      algorithm: ARGON2ID,
      memoryCost: params.memoryKib,
      timeCost: params.timeCost,
      parallelism: params.parallelism,
    }),
  verify: (hash, password) => argonVerify(hash, password),
};

class Semaphore {
  private waiting: Array<() => void> = [];
  private active = 0;
  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

/**
 * argon2id with at most two hashes running at once, so a login flood cannot exhaust memory or CPU
 * (SECURITY.md section 4). Parameters live in the PHC string, so old hashes keep verifying after a tune.
 */
export class PasswordHasher {
  private readonly gate: Semaphore;
  private readonly engine: HashEngine;
  private dummy: Promise<string> | null = null;

  constructor(
    private readonly params: HashParams = DEFAULT_HASH_PARAMS,
    options: { concurrency?: number; engine?: HashEngine } = {},
  ) {
    this.gate = new Semaphore(options.concurrency ?? 2);
    this.engine = options.engine ?? argon2Engine;
  }

  async hash(password: string): Promise<string> {
    if ([...password].length > PASSWORD_MAX_LENGTH) throw new Error('Password too long');
    return this.gate.run(() => this.engine.hash(password, this.params));
  }

  async verify(storedHash: string, password: string): Promise<boolean> {
    if ([...password].length > PASSWORD_MAX_LENGTH) return false;
    try {
      return await this.gate.run(() => this.engine.verify(storedHash, password));
    } catch {
      return false;
    }
  }

  /** Burns the same work as a real check, so an unknown email takes as long as a wrong password. */
  async verifyDummy(password: string): Promise<boolean> {
    this.dummy ??= this.hash('dummy-password-for-timing-only');
    await this.verify(await this.dummy, password);
    return false;
  }

  needsRehash(storedHash: string): boolean {
    const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(storedHash);
    if (!match) return true;
    return (
      Number(match[1]) !== this.params.memoryKib ||
      Number(match[2]) !== this.params.timeCost ||
      Number(match[3]) !== this.params.parallelism
    );
  }
}
