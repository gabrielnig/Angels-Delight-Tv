import nodemailer, { type Transporter } from 'nodemailer';
import {
  renderTemplate,
  type BrandContext,
  type RenderedMail,
  type TemplateName,
} from './templates';

export interface OutgoingMail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** The seam for the delivery provider. SMTP covers Mailpit in development and most providers in production. */
export interface MailTransport {
  send(mail: OutgoingMail): Promise<{ messageId: string }>;
}

export class MailDeliveryError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Email delivery failed', options);
    this.name = 'MailDeliveryError';
  }
}

export class SmtpTransport implements MailTransport {
  constructor(private readonly transporter: Pick<Transporter, 'sendMail'>) {}

  static fromUrl(smtpUrl: string): SmtpTransport {
    return new SmtpTransport(nodemailer.createTransport(smtpUrl));
  }

  async send(mail: OutgoingMail): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return { messageId: String(info.messageId) };
  }
}

/** Collects messages in memory. Used by tests, and as a no-op sink when no provider is wanted. */
export class MemoryTransport implements MailTransport {
  readonly outbox: OutgoingMail[] = [];
  private failure: Error | null = null;

  failNext(error: Error): void {
    this.failure = error;
  }

  async send(mail: OutgoingMail): Promise<{ messageId: string }> {
    if (this.failure) {
      const error = this.failure;
      this.failure = null;
      throw error;
    }
    this.outbox.push(mail);
    return { messageId: `memory-${this.outbox.length}` };
  }
}

export interface MailerSettings extends BrandContext {
  /** Full From header, for example `Angels Delight TV <no-reply@example.org>`. */
  from: string;
  appOrigin: string;
}

/**
 * Typed transactional emails (M21). Sends directly from the calling process, one attempt. Callers decide how
 * to react to MailDeliveryError: sign up shows "could not send", reset keeps the generic message.
 */
export class Mailer {
  constructor(
    private readonly transport: MailTransport,
    private readonly settings: MailerSettings,
  ) {}

  private url(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.settings.appOrigin);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    return url.toString().replace(/\+/g, '%20');
  }

  private async deliver(
    to: string,
    name: TemplateName,
    vars: Record<string, string | number>,
  ): Promise<void> {
    const brand: BrandContext = {
      appName: this.settings.appName,
      supportEmail: this.settings.supportEmail,
      primaryColor: this.settings.primaryColor,
    };
    const rendered: RenderedMail = renderTemplate(name, vars, brand);
    try {
      await this.transport.send({ from: this.settings.from, to, ...rendered });
    } catch (error) {
      throw new MailDeliveryError({ cause: error });
    }
  }

  sendVerifyEmail(input: { to: string; code: string; token: string }) {
    return this.deliver(input.to, 'verify_email', {
      code: input.code,
      linkUrl: this.url('/verify-email/confirm', { token: input.token }),
    });
  }

  sendAlreadyRegistered(input: { to: string }) {
    return this.deliver(input.to, 'already_registered', {
      signInUrl: this.url('/sign-in'),
      resetUrl: this.url('/forgot-password'),
    });
  }

  sendPasswordReset(input: { to: string; token: string; minutes: number }) {
    return this.deliver(input.to, 'reset_password', {
      linkUrl: this.url('/reset-password', { token: input.token }),
      minutes: input.minutes,
    });
  }

  sendPasswordChanged(input: { to: string }) {
    return this.deliver(input.to, 'password_changed', {
      signInUrl: this.url('/sign-in'),
      resetUrl: this.url('/forgot-password'),
    });
  }

  sendLockoutNotice(input: { to: string; minutes: number }) {
    return this.deliver(input.to, 'lockout_notice', {
      resetUrl: this.url('/forgot-password'),
      minutes: input.minutes,
    });
  }

  sendAdminInvite(input: { to: string; role: string; token: string; hours: number }) {
    return this.deliver(input.to, 'admin_invite', {
      role: input.role,
      linkUrl: this.url(`/admin/invite/${encodeURIComponent(input.token)}`),
      hours: input.hours,
    });
  }

  sendEmailChangeVerify(input: { to: string; code: string; token: string }) {
    return this.deliver(input.to, 'email_change_verify', {
      code: input.code,
      linkUrl: this.url('/verify-email/confirm', { token: input.token }),
    });
  }

  sendEmailChangeNotice(input: { to: string }) {
    return this.deliver(input.to, 'email_change_notice', {
      resetUrl: this.url('/forgot-password'),
    });
  }

  sendTwoFactorReset(input: { to: string }) {
    return this.deliver(input.to, 'two_factor_reset', { signInUrl: this.url('/admin/login') });
  }

  sendStaffLockoutAlert(input: { to: string; account: string; minutes: number }) {
    return this.deliver(input.to, 'staff_lockout_alert', {
      account: input.account,
      minutes: input.minutes,
    });
  }

  sendAccountDeleted(input: { to: string }) {
    return this.deliver(input.to, 'account_deleted', {});
  }
}
