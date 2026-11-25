import { describe, expect, it } from 'vitest';
import { factCheckArticle, formatReport } from './fact-check-cli';

const md = (role: string) => `---
id: D02
role: ${role}
---
## Steps

1. Choose **Videos** in the side menu.
`;

describe('factCheckArticle', () => {
  it('fails before opening a browser when the role is too low, and names the role', async () => {
    const r = await factCheckArticle(md('admin'), {
      baseURL: 'http://localhost:3141',
      role: 'editor',
    });
    expect(r.ok).toBe(false);
    expect(r.failure?.reason).toMatch(/editor/);
    expect(r.failure?.reason).toMatch(/admin/);
  });

  it('refuses an origin that is not the demo stack', async () => {
    await expect(
      factCheckArticle(md('editor'), { baseURL: 'https://www.example.org', role: 'editor' }),
    ).rejects.toThrow(/refuses/);
  });
});

describe('formatReport', () => {
  it('names the first failing step', () => {
    const text = formatReport({
      id: 'D02',
      ok: false,
      role: 'editor',
      results: [{ n: 1, text: 'a', status: 'ok' }],
      failure: { n: 2, text: 'Click **Go**.', reason: 'Cannot find it.' },
    });
    expect(text).toContain('D02');
    expect(text).toContain('FAILED at step 2');
    expect(text).toContain('Cannot find it.');
  });
  it('reports a pass with the manual steps counted', () => {
    const text = formatReport({
      id: 'D02',
      ok: true,
      role: 'editor',
      results: [
        { n: 1, text: 'a', status: 'ok' },
        { n: 2, text: 'b', status: 'manual' },
      ],
      failure: null,
    });
    expect(text).toContain('passed');
    expect(text).toContain('1 manual');
  });
});
