import { describe, expect, it } from 'vitest';
import { newRequestId, requestIdFrom, REQUEST_ID_HEADER } from './request-id';

describe('request ids', () => {
  it('generates distinct, header safe ids', () => {
    const a = newRequestId();
    expect(a).toMatch(/^req_[a-z2-7]{16,}$/);
    expect(newRequestId()).not.toBe(a);
  });
  it('keeps a sane inbound id so a trace can span the proxy and the app', () => {
    expect(requestIdFrom(new Headers({ [REQUEST_ID_HEADER]: 'abc12345-def' }))).toBe(
      'abc12345-def',
    );
  });
  it('replaces missing, short, long or odd inbound ids', () => {
    for (const bad of ['', 'x', 'a'.repeat(100), 'bad id with spaces', 'inj\nect']) {
      const headers = new Headers();
      try {
        headers.set(REQUEST_ID_HEADER, bad);
      } catch {
        // some values cannot even be set as headers
      }
      expect(requestIdFrom(headers)).toMatch(/^req_/);
    }
    expect(requestIdFrom(new Headers())).toMatch(/^req_/);
  });
});
