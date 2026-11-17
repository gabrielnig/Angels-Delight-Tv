import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

describe('proxy request id (L-9)', () => {
  it('does not echo a hostile inbound x-request-id', () => {
    const res = proxy(
      new NextRequest('https://app.test/browse', { headers: { 'x-request-id': 'bad id <x>' } }),
    );
    const id = res.headers.get('x-request-id') ?? '';
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(id).not.toContain('bad');
  });
  it('keeps a well formed inbound id', () => {
    const res = proxy(
      new NextRequest('https://app.test/browse', { headers: { 'x-request-id': 'abc12345-def' } }),
    );
    expect(res.headers.get('x-request-id')).toBe('abc12345-def');
  });
});
