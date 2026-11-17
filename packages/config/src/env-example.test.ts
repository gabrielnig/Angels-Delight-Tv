import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEPLOY_ONLY_VARIABLES, ENV_VARIABLE_NAMES } from './env';

const example = readFileSync(resolve(import.meta.dirname, '../../../.env.example'), 'utf8');

function namesIn(text: string): Set<string> {
  const names = new Set<string>();
  for (const line of text.split('\n')) {
    const match = /^#?\s*([A-Z][A-Z0-9_]+)=/.exec(line);
    if (match?.[1]) names.add(match[1]);
  }
  return names;
}

describe('.env.example', () => {
  const documented = namesIn(example);

  it('lists every variable the env loaders read', () => {
    const missing = ENV_VARIABLE_NAMES.filter((name) => !documented.has(name));
    expect(missing).toEqual([]);
  });

  it('lists every deploy only variable', () => {
    const missing = DEPLOY_ONLY_VARIABLES.filter((name) => !documented.has(name));
    expect(missing).toEqual([]);
  });

  it('documents nothing the loaders do not know about', () => {
    const known = new Set<string>([...ENV_VARIABLE_NAMES, ...DEPLOY_ONLY_VARIABLES]);
    const unknown = [...documented].filter((name) => !known.has(name));
    expect(unknown).toEqual([]);
  });

  it('carries no secret values', () => {
    const filled = example
      .split('\n')
      .filter((line) =>
        /^(FIELD_KEK|EMAIL_HASH_PEPPER|HLS_KEK|PLAYBACK_TOKEN_SECRET|MEDIA_URL_SECRET|S3_SECRET_ACCESS_KEY)=\S/.test(
          line,
        ),
      );
    expect(filled).toEqual([]);
  });
});
