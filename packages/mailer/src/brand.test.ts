import { describe, expect, it } from 'vitest';
import { Mailer, MemoryTransport } from './mailer';
import { renderTemplate, type BrandContext } from './templates';

const vars = { linkUrl: 'https://tv.example.org/reset-password?token=abc', minutes: 30 };
const base: BrandContext = { appName: 'Sunrise TV', supportEmail: 'help@example.org' };

describe('branded email layout', () => {
  it('shows the site name as text when there is no logo', () => {
    const { html } = renderTemplate('reset_password', vars, base);
    expect(html).toContain('Sunrise TV');
    expect(html).not.toContain('<img');
  });

  it('shows the logo with the site name as alt text', () => {
    const { html } = renderTemplate(
      'reset_password',
      vars,
      { ...base, logoUrl: 'https://media.example.org/img/a/400-abc.webp' },
    );
    expect(html).toContain('<img src="https://media.example.org/img/a/400-abc.webp"');
    expect(html).toContain('alt="Sunrise TV"');
  });

  it('ignores a logo that is not an https or http web link', () => {
    const { html } = renderTemplate('reset_password', vars, { ...base, logoUrl: 'javascript:alert(1)' });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('javascript:');
  });

  it('uses the theme colours for page, card, text and buttons', () => {
    const { html } = renderTemplate('reset_password', vars, {
      ...base,
      primaryColor: '#6D4FC2',
      backgroundColor: '#F5F2FB',
      surfaceColor: '#FFFFFF',
      inkColor: '#1F1A2E',
      mutedColor: '#5B5470',
    });
    expect(html).toContain('background:#F5F2FB');
    expect(html).toContain('background:#6D4FC2');
    expect(html).toContain('color:#1F1A2E');
    expect(html).toContain('color:#5B5470');
  });

  it('drops a colour that is not a hex value', () => {
    const { html } = renderTemplate('reset_password', vars, { ...base, primaryColor: 'red;}<x' });
    expect(html).not.toContain('red;}');
    expect(html).toContain('background:#1F6FB5');
  });
});

describe('Mailer brand lookup', () => {
  const settings = {
    from: 'Sunrise <no-reply@example.org>',
    appName: 'Fallback TV',
    appOrigin: 'https://tv.example.org',
    supportEmail: 'help@example.org',
  };

  it('reads the name and logo from settings at send time', async () => {
    const transport = new MemoryTransport();
    let name = 'One TV';
    const mailer = new Mailer(transport, {
      ...settings,
      brand: async () => ({ appName: name, logoUrl: 'https://media.example.org/l.webp' }),
    });
    await mailer.sendPasswordChanged({ to: 'a@example.com' });
    name = 'Two TV';
    await mailer.sendPasswordChanged({ to: 'a@example.com' });
    expect(transport.outbox[0]!.subject).toContain('One TV');
    expect(transport.outbox[1]!.subject).toContain('Two TV');
    expect(transport.outbox[1]!.html).toContain('https://media.example.org/l.webp');
  });

  it('falls back to the configured brand when the lookup fails', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, {
      ...settings,
      brand: async () => {
        throw new Error('db down');
      },
    });
    await mailer.sendPasswordChanged({ to: 'a@example.com' });
    expect(transport.outbox[0]!.subject).toContain('Fallback TV');
  });
});
