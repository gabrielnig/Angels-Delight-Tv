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
  ['staff_lockout_alert', { account: 'e***@example.org', minutes: 30 }],
  ['staff_sign_in_code', { code: '482913', minutes: 10, device: 'Chrome on Windows', place: 'Nigeria', time: '2026-11-26 10:00 UTC', resetUrl: 'https://tv.example.org/forgot-password' }],
  ['staff_confirm_code', { code: '482913', minutes: 10, device: 'Chrome on Windows', place: 'Nigeria', time: '2026-11-26 10:00 UTC', resetUrl: 'https://tv.example.org/forgot-password' }],
  ['staff_second_step_changed', { method: 'email', device: 'Chrome on Windows', place: 'Nigeria', time: '2026-11-26 10:00 UTC', resetUrl: 'https://tv.example.org/forgot-password' }],
  ['account_deleted', {}],
  ['welcome', { homeUrl: 'https://tv.example.org/' }],
  ['export_ready', { linkUrl: 'https://tv.example.org/api/account/export?token=abc', hours: 24 }],
  ['export_failed', { retryUrl: 'https://tv.example.org/account/data' }],
  [
    'staff_notice',
    {
      title: 'Captions ready to review',
      body: 'Fractions',
      linkUrl: 'https://tv.example.org/admin/notices',
    },
  ],
  [
    'staff_summary',
    {
      period: 'hour',
      count: 3,
      lines: 'Captions ready to review: Fractions\nEncoding failed: Decimals\nReady: Shapes',
      linkUrl: 'https://tv.example.org/admin/notices',
    },
  ],
  [
    'staff_export_ready',
    { name: 'Audit log', rows: 52000, hours: 24, linkUrl: 'https://tv.example.org/admin/exports' },
  ],
  ['staff_export_failed', { name: 'Audit log', linkUrl: 'https://tv.example.org/admin/exports' }],
  ['donation_receipt', { reference: 'ad-don-abcdefghij0123456789', amount: 'N5,000', date: '24 November 2026', orgName: 'Angels Delight' }],
  ['mfa_enabled', { securityUrl: 'https://tv.example.org/account/security' }],
  ['mfa_disabled', { securityUrl: 'https://tv.example.org/account/security' }],
  ['recovery_codes_low', { remaining: 2, securityUrl: 'https://tv.example.org/account/security' }],
  ['recovery_code_used', { remaining: 8, securityUrl: 'https://tv.example.org/account/security' }],
  ['two_factor_reset_viewer', { signInUrl: 'https://tv.example.org/sign-in' }],
  [
    'new_device_sign_in',
    {
      device: 'Chrome on Android',
      country: 'Nigeria',
      time: '1 Dec 2026, 10:30 UTC',
      passwordUrl: 'https://tv.example.org/forgot-password',
      signOutUrl: 'https://tv.example.org/account/security',
    },
  ],
  ['google_linked', { securityUrl: 'https://tv.example.org/account/security' }],
  ['google_unlinked', { securityUrl: 'https://tv.example.org/account/security' }],
  [
    'deletion_scheduled',
    { cancelUrl: 'https://tv.example.org/account/deletion', purgeDate: '1 Dec 2026', days: 14 },
  ],
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

  it('puts each summary line in its own paragraph and escapes it', () => {
    const mail = renderTemplate(
      'staff_summary',
      {
        period: 'day',
        count: 2,
        lines: 'A <b>one</b>\nSecond',
        linkUrl: 'https://tv.example.org/admin/notices',
      },
      brand,
    );
    expect(mail.subject).toContain('2');
    expect(mail.text).toContain('A <b>one</b>\nSecond');
    expect(mail.html).toContain('A &lt;b&gt;one&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>one');
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

describe('every template (M21-S01 AC3)', () => {
  const rich: BrandContext = { ...brand, logoUrl: 'https://tv.example.org/logo.png' };
  it.each(cases)(
    '%s has html and text, one column, under 30 KB, no tracking pixel',
    (name, vars) => {
      const out = renderTemplate(name, vars, rich);
      expect(out.text.length).toBeGreaterThan(20);
      expect(out.html.length).toBeGreaterThan(100);
      expect(Buffer.byteLength(out.html)).toBeLessThan(30 * 1024);
      const imgs = out.html.match(/<img\b[^>]*>/g) ?? [];
      expect(imgs.length).toBeLessThanOrEqual(1);
      for (const img of imgs) {
        expect(img).toContain('alt=');
        expect(img).not.toMatch(/width="?[01]"?[\s>]/);
        expect(img).not.toMatch(/height="?[01]"?[\s>]/);
      }
      expect(out.html).not.toMatch(/<(script|iframe|link|form)\b/i);
      expect(out.html).not.toMatch(/(utm_|track|pixel|beacon)/i);
      expect(out.html).toContain('help@example.org');
    },
  );
  it.each(cases)('%s uses no dashes or emojis', (name, vars) => {
    const out = renderTemplate(name, vars, brand);
    expect(out.subject + out.text).not.toMatch(/[\u2013\u2014]/);
    expect(out.subject + out.text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('viewer_digest template (M44-S15)', () => {
  const vars = {
    period: 'day',
    count: 3,
    lines: ['3 new episodes of Everyday Science', '5 new videos', 'New episode of Money Skills'].join('\n'),
    linkUrl: 'https://tv.example.org/notifications',
    unsubscribeUrl: 'https://tv.example.org/unsubscribe/notices?token=abc.def',
  };

  it('renders html and text under 30 KB with the lines, the unsubscribe link and no tracking pixel', () => {
    const mail = renderTemplate('viewer_digest', vars, brand);
    expect(mail.subject).toContain('Angels Delight TV');
    expect(mail.text).toContain('3 new episodes of Everyday Science');
    expect(mail.text).toContain(vars.unsubscribeUrl);
    expect(mail.html).toContain(vars.unsubscribeUrl);
    expect(Buffer.byteLength(mail.html)).toBeLessThan(30 * 1024);
    expect(mail.html).not.toMatch(/<img/i);
    expect(mail.html + mail.text).not.toContain('undefined');
  });

  it('carries the List-Unsubscribe headers for one click unsubscribe', () => {
    const mail = renderTemplate('viewer_digest', vars, brand);
    expect(mail.headers).toEqual({
      'List-Unsubscribe': `<${vars.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('says week for a weekly digest, and refuses a missing unsubscribe link or a non web link', () => {
    expect(renderTemplate('viewer_digest', { ...vars, period: 'week' }, brand).subject).toContain('this week');
    expect(() => renderTemplate('viewer_digest', { ...vars, unsubscribeUrl: '' }, brand)).toThrow(TemplateError);
    expect(() => renderTemplate('viewer_digest', { ...vars, unsubscribeUrl: 'javascript:alert(1)' }, brand)).toThrow(TemplateError);
  });
});
