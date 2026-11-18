import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VITAL_NAMES } from '@ad/analytics/client';

// The root of @ad/analytics pulls zod and the database code into the browser (about 30 KB gzip on every page).
// Files that run in the browser import only from @ad/analytics/client.
const BROWSER_FILES = ['vitals.ts', 'browser.ts'];

describe('browser analytics code stays small', () => {
  it('exposes the vital names from the client entry', () => {
    expect(VITAL_NAMES).toEqual(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);
  });

  it.each(BROWSER_FILES)('%s does not import the @ad/analytics root', (file) => {
    const source = readFileSync(resolve(import.meta.dirname, file), 'utf8');
    expect(source).not.toMatch(/^import (?!type)[^\n]*from '@ad\/analytics'/m);
  });
});
