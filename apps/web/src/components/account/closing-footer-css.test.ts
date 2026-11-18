import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(import.meta.dirname, 'account.css'), 'utf8');

describe('soft footer on the closing layout (S30 state 6)', () => {
  it.each(['.ad-footer', '.ad-footer__links', '.ad-footer__links a', '.ad-footer__support'])(
    'styles %s inside the closing page scope as well as the shell',
    (selector) => {
      expect(css).toContain(`.acct-site[data-skin='soft'] ${selector}`);
    },
  );
});

describe('tokens reach portaled dialogs and match the S29 skeleton', () => {
  it('defines the heading tokens on the dialog as well as the page scope', () => {
    expect(css).toMatch(/\.acct-dialog[^{]*\{[^}]*--acct-h2-lg/);
  });

  it('draws the settings skeleton bars at the mockup sizes', () => {
    expect(css).toMatch(/data-s='text'\]\s*\{\s*width:\s*11\.25rem;[^}]*height:\s*1rem;/);
    expect(css).toMatch(/data-s='sub'\]\s*\{\s*width:\s*17\.5rem;[^}]*height:\s*0\.75rem;/);
  });
});

it('sets dialog titles in the display font', () => {
  expect(css).toMatch(/\.acct-dialog \.ad-modal__title\s*\{[^}]*font-family:\s*var\(--font-display\)/);
});
