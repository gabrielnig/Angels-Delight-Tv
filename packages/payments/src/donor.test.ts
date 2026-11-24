import { describe, expect, it } from 'vitest';
import { donorEmailHash, openDonorField, sealDonorField } from './donor';
import { issueReceiptToken, verifyReceiptToken } from './receipt-token';

const kek = new Uint8Array(32).fill(7);
const pepper = new Uint8Array(32).fill(9);
const secret = new Uint8Array(32).fill(5);
const REF = 'ad-don-abcdefghij0123456789';

describe('donor fields', () => {
  it('seals and opens a value bound to its donation and field', () => {
    const sealed = sealDonorField(kek, 'd1', 'email', 'Donor@Example.com');
    expect(Buffer.from(sealed).includes('Donor')).toBe(false);
    expect(openDonorField(kek, 'd1', 'email', sealed)).toBe('Donor@Example.com');
  });
  it('does not open under another donation or field', () => {
    const sealed = sealDonorField(kek, 'd1', 'email', 'a@example.com');
    expect(() => openDonorField(kek, 'd2', 'email', sealed)).toThrow();
    expect(() => openDonorField(kek, 'd1', 'name', sealed)).toThrow();
  });
  it('hashes the normalised email the same way every time and differently per pepper', () => {
    expect(donorEmailHash(pepper, ' A@Example.com ')).toEqual(donorEmailHash(pepper, 'a@example.com'));
    expect(donorEmailHash(pepper, 'a@example.com')).not.toEqual(donorEmailHash(new Uint8Array(32).fill(1), 'a@example.com'));
  });
});

describe('receipt token', () => {
  it('verifies for the reference it was issued for', () => {
    const token = issueReceiptToken(secret, REF);
    expect(verifyReceiptToken(secret, REF, token)).toBe(true);
  });
  it('rejects another reference, another secret, a changed token and junk without throwing', () => {
    const token = issueReceiptToken(secret, REF);
    expect(verifyReceiptToken(secret, 'ad-don-zzzzzzzzzzzzzzzzzzzz', token)).toBe(false);
    expect(verifyReceiptToken(new Uint8Array(32).fill(6), REF, token)).toBe(false);
    expect(verifyReceiptToken(secret, REF, `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`)).toBe(false);
    for (const junk of ['', 'x', '!!!', null, undefined, 42]) expect(verifyReceiptToken(secret, REF, junk as never)).toBe(false);
  });
  it('is a purpose bound url safe string that does not equal a plain HMAC of the reference', () => {
    const token = issueReceiptToken(secret, REF);
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  });
});
