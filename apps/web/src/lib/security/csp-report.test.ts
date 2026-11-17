import { describe, expect, it } from 'vitest';
import { handleCspReport } from './csp-report';

const post = (body: string, type = 'application/csp-report') =>
  new Request('https://app.test/api/csp-report', {
    method: 'POST',
    headers: { 'content-type': type },
    body,
  });

describe('handleCspReport (L-8)', () => {
  it('answers 204 and logs only a short allowlisted summary of a legacy report', async () => {
    const logged: Record<string, unknown>[] = [];
    const res = await handleCspReport(
      post(
        JSON.stringify({
          'csp-report': {
            'violated-directive': 'script-src',
            'blocked-uri': 'https://evil.test/x.js?token=secret',
            'document-uri': 'https://app.test/browse?email=a@b.co',
            'script-sample': 'x'.repeat(500),
          },
        }),
      ),
      (entry) => logged.push(entry),
    );
    expect(res.status).toBe(204);
    expect(logged).toHaveLength(1);
    const text = JSON.stringify(logged[0]);
    expect(text).toContain('script-src');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('a@b.co');
    expect(text.length).toBeLessThan(600);
  });

  it('refuses a body over the size cap without parsing it', async () => {
    const res = await handleCspReport(post('x'.repeat(20_000)), () => {
      throw new Error('must not log');
    });
    expect(res.status).toBe(413);
  });

  it('answers 204 for malformed json and other content types, logging nothing', async () => {
    const logged: unknown[] = [];
    expect((await handleCspReport(post('not json'), (e) => logged.push(e))).status).toBe(204);
    expect((await handleCspReport(post('{}', 'text/html'), (e) => logged.push(e))).status).toBe(
      204,
    );
    expect(logged).toEqual([]);
  });

  it('handles the reports+json array form', async () => {
    const logged: unknown[] = [];
    const res = await handleCspReport(
      post(
        JSON.stringify([{ type: 'csp-violation', body: { effectiveDirective: 'img-src' } }]),
        'application/reports+json',
      ),
      (e) => logged.push(e),
    );
    expect(res.status).toBe(204);
    expect(JSON.stringify(logged)).toContain('img-src');
  });
});
