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
});
