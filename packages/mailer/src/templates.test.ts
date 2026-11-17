import { describe, expect, it } from 'vitest';
import { TemplateError, renderTemplate, type BrandContext, type TemplateName } from './templates';

const brand: BrandContext = {
  appName: 'Angels Delight TV',
  supportEmail: 'help@example.org',
};

const cases: Array<[TemplateName, Record<string, string | number>]> = [
  [
    'verify_email',
    { code: '482913', linkUrl: 'https://tv.example.org/verify-email/confirm?token=abc' },
  ],
  [
    'already_registered',
    {
      signInUrl: 'https://tv.example.org/sign-in',
      resetUrl: 'https://tv.example.org/forgot-password',
    },
  ],
  ['reset_password', { linkUrl: 'https://tv.example.org/reset-password?token=abc', minutes: 30 }],
  [
    'password_changed',
    {
      signInUrl: 'https://tv.example.org/sign-in',
      resetUrl: 'https://tv.example.org/forgot-password',
    },
  ],
  ['lockout_notice', { resetUrl: 'https://tv.example.org/forgot-password', minutes: 15 }],
  [
    'admin_invite',
    { role: 'editor', linkUrl: 'https://tv.example.org/admin/invite?token=abc', hours: 72 },
  ],
  [
    'email_change_verify',
    { code: '110022', linkUrl: 'https://tv.example.org/verify-email/confirm?token=abc' },
  ],
  ['email_change_notice', { resetUrl: 'https://tv.example.org/forgot-password' }],
  ['two_factor_reset', { signInUrl: 'https://tv.example.org/admin/login' }],
  ['account_deleted', {}],
];

describe('renderTemplate', () => {
  it.each(cases)('%s has a subject, plain text and HTML', (name, vars) => {
    const mail = renderTemplate(name, vars, brand);
    expect(mail.subject.length).toBeGreaterThan(5);
    expect(mail.text.length).toBeGreaterThan(20);
    expect(mail.html).toContain('<html');
  });

  it.each(cases)('%s names the support address and uses no dashes or emojis', (name, vars) => {
    const mail = renderTemplate(name, vars, brand);
    for (const body of [mail.subject, mail.text, mail.html]) {
      expect([0x2013, 0x2014].some((code) => body.includes(String.fromCharCode(code)))).toBe(false);
      expect(body).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    expect(mail.text).toContain('help@example.org');
    expect(mail.html).toContain('help@example.org');
  });

  it.each(cases)('%s stays under 30 KB and has no tracking pixel', (name, vars) => {
    const mail = renderTemplate(name, vars, brand);
    expect(Buffer.byteLength(mail.html)).toBeLessThan(30 * 1024);
    expect(mail.html).not.toMatch(/<img/i);
  });

  it('shows the code large in the body and keeps it out of the subject', () => {
    const mail = renderTemplate('verify_email', cases[0]![1], brand);
    expect(mail.subject).not.toContain('482913');
    expect(mail.text).toContain('482913');
    expect(mail.html).toMatch(/font-size:\s*32px[^>]*>\s*482913/);
  });

  it('gives the main action as a button and as a plain link in HTML and text', () => {
    const mail = renderTemplate('reset_password', cases[2]![1], brand);
    const link = 'https://tv.example.org/reset-password?token=abc';
    expect(mail.text).toContain(link);
    expect(
      mail.html.match(new RegExp(link.replace(/[?]/g, '\\?'), 'g'))!.length,
    ).toBeGreaterThanOrEqual(2);
    expect(mail.html).toContain('role="presentation"');
  });

  it('states how long a link lasts', () => {
    expect(renderTemplate('reset_password', cases[2]![1], brand).text).toContain('30 minutes');
    expect(renderTemplate('admin_invite', cases[5]![1], brand).text).toContain('72 hours');
  });

  it('escapes HTML in brand and variable values', () => {
    const mail = renderTemplate(
      'lockout_notice',
      { resetUrl: 'https://tv.example.org/x?a=1&b=2', minutes: 15 },
      { ...brand, appName: '<script>alert(1)</script>' },
    );
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('a=1&amp;b=2');
  });

  it('refuses to render when a variable is missing instead of sending undefined', () => {
    expect(() => renderTemplate('verify_email', { code: '123456' }, brand)).toThrow(TemplateError);
    expect(() => renderTemplate('verify_email', { code: '', linkUrl: 'x' }, brand)).toThrow(
      TemplateError,
    );
  });

  it('refuses a link that is not http or https', () => {
    expect(() =>
      renderTemplate('reset_password', { linkUrl: 'javascript:alert(1)', minutes: 30 }, brand),
    ).toThrow(TemplateError);
  });
});
