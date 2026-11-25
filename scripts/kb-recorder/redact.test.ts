import { describe, expect, it } from 'vitest';
import { EMAIL_PATTERN, isFakeDomain, redactEmails } from './redact';

describe('isFakeDomain', () => {
  it('treats reserved example domains as safe to show', () => {
    for (const d of [
      'example.com',
      'example.test',
      'example.org',
      'mail.example.net',
      'EXAMPLE.COM',
      'demo.invalid',
    ]) {
      expect(isFakeDomain(d)).toBe(true);
    }
  });
  it('does not treat look alikes or real providers as safe', () => {
    for (const d of ['gmail.com', 'notexample.com', 'example.com.ng', 'example.comx.org']) {
      expect(isFakeDomain(d)).toBe(false);
    }
  });
});

describe('redactEmails', () => {
  it('hides real addresses and keeps example addresses by default', () => {
    expect(redactEmails('Write to jane.doe@gmail.com or demo.owner@example.test today')).toBe(
      'Write to [email hidden] or demo.owner@example.test today',
    );
  });
  it('hides every address when asked to, including fake ones', () => {
    expect(redactEmails('demo.owner@example.test', { keepFake: false })).toBe('[email hidden]');
  });
  it('handles plus tags, dots, hyphens and several addresses in one string', () => {
    expect(redactEmails('a+tag@my-co.co.ng, b.c@x.io')).toBe('[email hidden], [email hidden]');
  });
  it('leaves text without an address untouched, including at signs in handles', () => {
    expect(redactEmails('Follow @angelsdelight now')).toBe('Follow @angelsdelight now');
  });
  it('is stable when run twice', () => {
    const once = redactEmails('x@gmail.com');
    expect(redactEmails(once)).toBe(once);
  });
  it('exposes a pattern source that can be shipped to the browser', () => {
    expect(new RegExp(EMAIL_PATTERN, 'g').test('a@b.co')).toBe(true);
  });
});
