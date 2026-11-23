import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  backoffSeconds,
  describeSendError,
  isPermanentSendError,
  openAddress,
  sealAddress,
} from './outbox';

const kek = new Uint8Array(randomBytes(32));

describe('sealed addresses', () => {
  it('round trips and keeps the address out of the stored bytes', () => {
    const sealed = sealAddress(kek, 'outbox:1', 'ada@example.org');
    expect(sealed.toString('utf8')).not.toContain('ada@example.org');
    expect(openAddress(kek, 'outbox:1', sealed)).toBe('ada@example.org');
  });

  it('refuses to open under another scope or key, so a copied value is useless elsewhere', () => {
    const sealed = sealAddress(kek, 'outbox:1', 'ada@example.org');
    expect(() => openAddress(kek, 'outbox:2', sealed)).toThrow();
    expect(() => openAddress(new Uint8Array(randomBytes(32)), 'outbox:1', sealed)).toThrow();
  });
});

describe('send errors', () => {
  it('closes a row at once, with a clear text, when email is not configured', () => {
    const off = Object.assign(new Error('Email is not configured. Set SMTP_URL to enable sending.'), {
      name: 'EmailNotConfigured',
    });
    expect(isPermanentSendError(off)).toBe(true);
    expect(describeSendError(off)).toMatch(/^Email is not configured/);
  });

  it('treats an SMTP 5xx reply as permanent, also when wrapped', () => {
    const smtp = Object.assign(new Error('mailbox unavailable'), { responseCode: 550 });
    expect(isPermanentSendError(smtp)).toBe(true);
    expect(isPermanentSendError(new Error('x', { cause: smtp }))).toBe(true);
  });

  it('retries timeouts, 4xx replies and unknown errors', () => {
    expect(isPermanentSendError(new Error('timeout'))).toBe(false);
    expect(isPermanentSendError(Object.assign(new Error('busy'), { responseCode: 451 }))).toBe(
      false,
    );
  });

  it('never keeps an address in the stored error text, and caps its length', () => {
    const text = describeSendError(new Error(`rejected ada@example.org ${'x'.repeat(500)}`));
    expect(text).not.toContain('ada@example.org');
    expect(text.length).toBeLessThanOrEqual(300);
  });

  it('waits longer after each failed attempt', () => {
    const waits = [1, 2, 3, 4, 5].map(backoffSeconds);
    expect(waits).toEqual([...waits].sort((a, b) => a - b));
    expect(waits[0]).toBeGreaterThanOrEqual(60);
  });
});
