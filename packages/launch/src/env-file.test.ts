import { describe, expect, it } from 'vitest';
import { envValuesFor, updateEnvText } from './env-file';

const sample = ['# comment', 'APP_DOMAIN=', 'APP_ORIGIN=https://old.example', 'KEEP=1', ''].join(
  '\n',
);

describe('updateEnvText', () => {
  it('replaces existing values, keeps comments and order, appends missing names', () => {
    const { text, changes } = updateEnvText(sample, {
      APP_DOMAIN: 'a.example',
      APP_ORIGIN: 'https://a.example',
      NEW_ONE: 'x',
    });
    expect(text).toBe(
      [
        '# comment',
        'APP_DOMAIN=a.example',
        'APP_ORIGIN=https://a.example',
        'KEEP=1',
        'NEW_ONE=x',
        '',
      ].join('\n'),
    );
    expect(changes.map((c) => c.name)).toEqual(['APP_DOMAIN', 'APP_ORIGIN', 'NEW_ONE']);
  });

  it('is idempotent', () => {
    const first = updateEnvText(sample, { APP_DOMAIN: 'a.example' });
    const second = updateEnvText(first.text, { APP_DOMAIN: 'a.example' });
    expect(second.text).toBe(first.text);
    expect(second.changes).toEqual([]);
  });

  it('updates a commented example line in place', () => {
    const { text } = updateEnvText('# SUPPORT_EMAIL=\n', { SUPPORT_EMAIL: 'a@b.example' });
    expect(text).toBe('SUPPORT_EMAIL=a@b.example\n');
  });

  it('refuses values with newlines', () => {
    expect(() => updateEnvText('', { A: 'x\nB=1' })).toThrow();
  });
});

describe('envValuesFor', () => {
  it('drops characters that would break an env file or be expanded by compose', () => {
    const values = envValuesFor({
      platformName: 'Joy $HOME #1 "TV" <b>',
      domain: 'tv.example',
      supportEmail: 'help@tv.example',
      adminOwnerEmail: 'o@tv.example',
    });
    expect(values.EMAIL_FROM).toBe('Joy HOME 1 TV b <no-reply@tv.example>');
  });

  it('derives origins and the From address from the domain', () => {
    const values = envValuesFor({
      platformName: 'Name',
      domain: 'tv.example',
      supportEmail: 'help@tv.example',
      adminOwnerEmail: 'o@tv.example',
    });
    expect(values).toEqual({
      APP_DOMAIN: 'tv.example',
      MEDIA_DOMAIN: 'media.tv.example',
      APP_ORIGIN: 'https://tv.example',
      MEDIA_ORIGIN: 'https://media.tv.example',
      SUPPORT_EMAIL: 'help@tv.example',
      EMAIL_FROM: 'Name <no-reply@tv.example>',
    });
  });

  it('uses an explicit media domain', () => {
    const values = envValuesFor({
      platformName: 'N',
      domain: 'tv.example',
      mediaDomain: 'cdn.tv.example',
      supportEmail: 'help@tv.example',
      adminOwnerEmail: 'o@tv.example',
    });
    expect(values.MEDIA_ORIGIN).toBe('https://cdn.tv.example');
  });
});
