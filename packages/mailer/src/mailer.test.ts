import nodemailer from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { Mailer, MailDeliveryError, MemoryTransport, SmtpTransport } from './mailer';

const settings = {
  from: 'Angels Delight TV <no-reply@example.org>',
  appName: 'Angels Delight TV',
  appOrigin: 'https://tv.example.org',
  supportEmail: 'help@example.org',
};

describe('Mailer', () => {
  it('builds the verification email with absolute links on the app origin', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, settings);
    await mailer.sendVerifyEmail({ to: 'tobi@example.com', code: '123456', token: 'tok_abc' });
    const [sent] = transport.outbox;
    expect(sent?.to).toBe('tobi@example.com');
    expect(sent?.from).toBe(settings.from);
    expect(sent?.text).toContain('123456');
    expect(sent?.text).toContain('https://tv.example.org/verify-email/confirm?token=tok_abc');
  });

  it('builds reset, lockout and invite links', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, settings);
    await mailer.sendPasswordReset({ to: 'a@example.com', token: 'r1', minutes: 30 });
    await mailer.sendLockoutNotice({ to: 'a@example.com', minutes: 15 });
    await mailer.sendAdminInvite({ to: 'b@example.com', role: 'editor', token: 'i1', hours: 72 });
    expect(transport.outbox[0]?.text).toContain('https://tv.example.org/reset-password?token=r1');
    expect(transport.outbox[1]?.text).toContain('https://tv.example.org/forgot-password');
    expect(transport.outbox[2]?.text).toContain('https://tv.example.org/admin/invite/i1');
  });

  it('tells an admin that a staff account was locked without naming the address in full', async () => {
    const transport = new MemoryTransport();
    await new Mailer(transport, settings).sendStaffLockoutAlert({
      to: 'boss@example.org',
      account: 'e***@example.org',
      minutes: 30,
    });
    expect(transport.outbox[0]?.text).toContain('e***@example.org');
    expect(transport.outbox[0]?.subject).toMatch(/staff account/i);
  });

  it('url encodes tokens', async () => {
    const transport = new MemoryTransport();
    await new Mailer(transport, settings).sendPasswordReset({
      to: 'a@example.com',
      token: 'a b&c',
      minutes: 30,
    });
    expect(transport.outbox[0]?.text).toContain('token=a%20b%26c');
  });

  it('wraps a transport failure in MailDeliveryError without leaking the address', async () => {
    const transport = new MemoryTransport();
    transport.failNext(new Error('550 mailbox unavailable for tobi@example.com'));
    const mailer = new Mailer(transport, settings);
    const error = await mailer
      .sendPasswordChanged({ to: 'tobi@example.com' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MailDeliveryError);
    expect((error as Error).message).not.toContain('tobi@example.com');
  });

  it('does not send when the template cannot render', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, settings);
    await expect(
      mailer.sendVerifyEmail({ to: 'a@example.com', code: '', token: 't' }),
    ).rejects.toThrow();
    expect(transport.outbox).toHaveLength(0);
  });
});

describe('SmtpTransport', () => {
  it('sends multipart text and html and returns the provider message id', async () => {
    const transporter = nodemailer.createTransport({ jsonTransport: true });
    const transport = new SmtpTransport(transporter);
    const result = await transport.send({
      from: settings.from,
      to: 'tobi@example.com',
      subject: 'Hello',
      text: 'plain body',
      html: '<p>html body</p>',
    });
    expect(result.messageId).toBeTruthy();
    const info = await transporter.sendMail({
      from: settings.from,
      to: 'x@example.com',
      subject: 's',
      text: 't',
    });
    expect(JSON.parse(String(info.message)).subject).toBe('s');
  });

  it('is created from an smtp url', () => {
    expect(SmtpTransport.fromUrl('smtp://localhost:1025')).toBeInstanceOf(SmtpTransport);
  });

  it('rejects header injection in the subject', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, { ...settings, appName: 'Bad\r\nBcc: x@y.z' });
    await mailer.sendAccountDeleted({ to: 'a@example.com' });
    expect(transport.outbox[0]?.subject).not.toMatch(/[\r\n]/);
  });

  it('sends the deletion notice with the purge date and a link to cancel by signing in', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, settings);
    await mailer.sendDeletionScheduled({ to: 'a@example.com', purgeDate: '1 Dec 2026', days: 14 });
    const mail = transport.outbox[0];
    expect(mail?.subject).toMatch(/will be deleted/i);
    expect(mail?.text).toContain('1 Dec 2026');
    expect(mail?.text).toContain('/account/deletion');
  });

  it('sends the export link for 24 hours and the failure notice', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, settings);
    await mailer.sendExportReady({ to: 'a@example.com', token: 'abc.def', hours: 24 });
    expect(transport.outbox[0]?.text).toContain('/api/account/export?token=abc.def');
    await mailer.sendExportFailed({ to: 'a@example.com' });
    expect(transport.outbox[1]?.subject).toMatch(/could not build your export/i);
  });
});

describe('Mailer staff mail', () => {
  it('returns the provider message id so the outbox can record it', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, settings);
    const sent = await mailer.sendStaffNotice({
      to: 'staff@example.org',
      title: 'Encoding failed',
      body: 'Decimals',
    });
    expect(sent).toEqual({ messageId: 'memory-1' });
    expect(transport.outbox[0]?.subject).toBe('Encoding failed');
    expect(transport.outbox[0]?.text).toContain('Decimals');
    expect(transport.outbox[0]?.text).toContain('https://tv.example.org/admin');
  });

  it('builds a summary with a count and one line per update', async () => {
    const transport = new MemoryTransport();
    await new Mailer(transport, settings).sendStaffSummary({
      to: 'staff@example.org',
      period: 'day',
      lines: ['Ready: Shapes', 'Encoding failed: Decimals'],
    });
    expect(transport.outbox[0]?.subject).toContain('2 updates');
    expect(transport.outbox[0]?.text).toContain('Ready: Shapes\nEncoding failed: Decimals');
  });

  it('links an export mail to the exports page', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, settings);
    await mailer.sendStaffExportReady({
      to: 'a@example.org',
      name: 'Audit log',
      rows: 52000,
      hours: 24,
    });
    await mailer.sendStaffExportFailed({ to: 'a@example.org', name: 'Audit log' });
    expect(transport.outbox[0]?.text).toContain('https://tv.example.org/admin/exports');
    expect(transport.outbox[0]?.text).toContain('52000');
    expect(transport.outbox[1]?.text).toContain('https://tv.example.org/admin/exports');
  });

  it('wraps a provider failure and keeps its cause for the outbox to read', async () => {
    const transport = new MemoryTransport();
    transport.failNext(Object.assign(new Error('mailbox unavailable'), { responseCode: 550 }));
    const error = await new Mailer(transport, settings)
      .sendStaffNotice({ to: 'a@example.org', title: 'Hello there' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MailDeliveryError);
    expect((error as MailDeliveryError).cause).toMatchObject({ responseCode: 550 });
  });
});

describe('Mailer viewer digest (M44-S15)', () => {
  it('sends the digest with the unsubscribe headers and an unsubscribe link on the app origin', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, settings);
    const sent = await mailer.sendViewerDigest({ to: 'a@example.com', period: 'day', lines: ['5 new videos'], unsubscribeToken: 'tok.sig' });
    expect(sent?.messageId).toBeTruthy();
    const [mail] = transport.outbox;
    expect(mail?.headers?.['List-Unsubscribe']).toBe('<https://tv.example.org/unsubscribe/notices?token=tok.sig>');
    expect(mail?.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(mail?.text).toContain('https://tv.example.org/notifications');
  });

  it('skips a suppressed address, because the digest is not essential mail', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, { ...settings, isSuppressed: async () => true });
    const sent = await mailer.sendViewerDigest({ to: 'a@example.com', period: 'week', lines: ['x'], unsubscribeToken: 't' });
    expect(sent).toBeNull();
    expect(transport.outbox).toHaveLength(0);
  });
});
