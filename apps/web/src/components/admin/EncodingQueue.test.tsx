import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const encoding = readFileSync(new URL('./EncodingQueue.tsx', import.meta.url), 'utf8');
const failed = readFileSync(new URL('./FailedEncodes.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./admin.css', import.meta.url), 'utf8');

describe('Encoding queue and Failed encodes containers (L3-01)', () => {
  it('the jobs list is a card with padded rows', () => {
    expect(encoding).toContain('className="adm-card adm-list"');
    expect(failed).toContain('className="adm-card adm-list"');
    expect(css).toMatch(/\.adm-card\.adm-list \{[^}]*padding:\s*var\(--space-1\) var\(--space-4\)/);
  });
});
