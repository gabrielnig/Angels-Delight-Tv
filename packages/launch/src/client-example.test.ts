import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseClientConfig } from './client-config';

const text = readFileSync(resolve(import.meta.dirname, '../../../client.example.json'), 'utf8');

describe('client.example.json', () => {
  it('is refused as it stands, so placeholders cannot reach production', () => {
    const result = parseClientConfig(JSON.parse(text));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.errors.map((error) => error.path);
    expect(paths).toContain('platformName');
    expect(paths).toContain('domain');
    expect(paths).toContain('supportEmail');
    expect(paths).toContain('adminOwnerEmail');
  });

  it('is complete: with the placeholders replaced it is a valid config using every optional section', () => {
    const filled = text
      .replaceAll('replace-me-owner@example.org', 'owner@tv.example.org')
      .replaceAll('replace-me@example.org', 'help@tv.example.org')
      .replaceAll('media.replace-me.example', 'media.tv.example.org')
      .replaceAll('replace-me.example', 'tv.example.org')
      .replaceAll('REPLACE_ME ', '');
    const result = parseClientConfig(JSON.parse(filled));
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(Object.keys(result.config)).toEqual(
      expect.arrayContaining(['theme', 'logo', 'favicon', 'legal', 'languages', 'home']),
    );
  });
});
