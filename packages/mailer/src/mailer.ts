import nodemailer, { type Transporter } from 'nodemailer';
import {
  renderTemplate,
  type BrandContext,
  type RenderOptions,
  type RenderedMail,
  type TemplateName,
} from './templates';

export interface OutgoingMail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
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
      ...(mail.headers ? { headers: mail.headers } : {}),
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
  /**
   * Reads the site name, logo and theme colours from settings for each email, so a published change reaches the
   * next email without a deploy. A failure falls back to the values above.
   */
  brand?: () => Promise<Partial<BrandContext>>;
  /**
   * True for an address that bounced or complained (M21-S01 AC2). Only non essential mail is held back; codes,
   * resets and security notices always go. A failed lookup sends anyway.
   */
  isSuppressed?: (address: string) => Promise<boolean>;
  /**
   * The recipient's language and its effective catalog (accounts.locale), for viewer facing templates. No answer
   * or a failed lookup means English (M46-S18).
   */
  localization?: (address: string) => Promise<RenderOptions | undefined>;
}

/** Mail the person can live without. Everything else is a code, a link or a security notice. */
const NON_ESSENTIAL: ReadonlySet<TemplateName> = new Set<TemplateName>([
  'welcome',
  'viewer_digest',
]);

/**
 * Typed transactional emails (M21). Sends directly from the calling process, one attempt. Callers decide how
 * to react to MailDeliveryError: sign up shows "could not send", reset keeps the generic message.
 */
/** Where and when a staff code was asked for, in coarse words. A raw address never goes into the mail. */
export interface StaffCodeMail {
  to: string;
  code: string;
  minutes: number;
  device: string;
  place: string;
  time: string;
}

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
    await this.deliverWithId(to, name, vars);
  }

  /** Same as `deliver`, but hands back the provider message id (null when a suppressed address was skipped). */
  private async deliverWithId(
    to: string,
    name: TemplateName,
    vars: Record<string, string | number>,
  ): Promise<{ messageId: string } | null> {
    if (NON_ESSENTIAL.has(name) && this.settings.isSuppressed) {
      try {
        if (await this.settings.isSuppressed(to)) return null;
      } catch {
        // an unavailable list must not stop mail
      }
    }
    let live: Partial<BrandContext> = {};
    try {
      live = (await this.settings.brand?.()) ?? {};
    } catch {
      // keep the configured brand
    }
    const brand: BrandContext = {
      appName: this.settings.appName,
      supportEmail: this.settings.supportEmail,
      primaryColor: this.settings.primaryColor,
      ...Object.fromEntries(Object.entries(live).filter(([, v]) => v !== undefined && v !== '')),
    };
    let options: RenderOptions | undefined;
    try {
      options = await this.settings.localization?.(to);
    } catch {
      // English is better than no mail
    }
    const rendered: RenderedMail = renderTemplate(name, vars, brand, options);
    try {
      return await this.transport.send({ from: this.settings.from, to, ...rendered });
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

  sendWelcome(input: { to: string }) {
    return this.deliver(input.to, 'welcome', { homeUrl: this.url('/') });
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

  sendViewerTwoFactorReset(input: { to: string }) {
    return this.deliver(input.to, 'two_factor_reset_viewer', { signInUrl: this.url('/sign-in') });
  }

  sendMfaEnabled(input: { to: string }) {
    return this.deliver(input.to, 'mfa_enabled', { securityUrl: this.url('/account/security') });
  }

  sendMfaDisabled(input: { to: string }) {
    return this.deliver(input.to, 'mfa_disabled', { securityUrl: this.url('/account/security') });
  }

  sendRecoveryCodesLow(input: { to: string; remaining: number }) {
    return this.deliver(input.to, 'recovery_codes_low', {
      remaining: input.remaining,
      securityUrl: this.url('/account/security'),
    });
  }

  sendRecoveryCodeUsed(input: { to: string; remaining: number }) {
    return this.deliver(input.to, 'recovery_code_used', {
      remaining: input.remaining,
      securityUrl: this.url('/account/security'),
    });
  }

  sendNewDeviceSignIn(input: { to: string; device: string; country: string; time: string }) {
    return this.deliver(input.to, 'new_device_sign_in', {
      device: input.device,
      country: input.country,
      time: input.time,
      passwordUrl: this.url('/forgot-password'),
      signOutUrl: this.url('/account/security'),
    });
  }

  sendGoogleLinked(input: { to: string }) {
    return this.deliver(input.to, 'google_linked', { securityUrl: this.url('/account/security') });
  }

  sendGoogleUnlinked(input: { to: string }) {
    return this.deliver(input.to, 'google_unlinked', {
      securityUrl: this.url('/account/security'),
    });
  }

  sendStaffLockoutAlert(input: { to: string; account: string; minutes: number }) {
    return this.deliver(input.to, 'staff_lockout_alert', {
      account: input.account,
      minutes: input.minutes,
    });
  }

  sendStaffSignInCode(input: StaffCodeMail) {
    return this.deliver(input.to, 'staff_sign_in_code', this.staffCodeVars(input));
  }

  sendStaffConfirmCode(input: StaffCodeMail) {
    return this.deliver(input.to, 'staff_confirm_code', this.staffCodeVars(input));
  }

  private staffCodeVars(input: StaffCodeMail) {
    return {
      code: input.code,
      minutes: input.minutes,
      device: input.device,
      place: input.place,
      time: input.time,
      resetUrl: this.url('/forgot-password'),
    };
  }

  sendAccountDeleted(input: { to: string }) {
    return this.deliver(input.to, 'account_deleted', {});
  }

  sendDeletionScheduled(input: { to: string; purgeDate: string; days: number }) {
    return this.deliver(input.to, 'deletion_scheduled', {
      cancelUrl: this.url('/account/deletion'),
      purgeDate: input.purgeDate,
      days: input.days,
    });
  }

  sendExportReady(input: { to: string; token: string; hours: number }) {
    return this.deliver(input.to, 'export_ready', {
      linkUrl: this.url('/api/account/export', { token: input.token }),
      hours: input.hours,
    });
  }

  sendExportFailed(input: { to: string }) {
    return this.deliver(input.to, 'export_failed', { retryUrl: this.url('/account/data') });
  }

  /** One notification for one staff member (M21-S03). Returns the provider message id for the outbox. */
  sendStaffNotice(input: { to: string; title: string; body?: string }) {
    return this.deliverWithId(input.to, 'staff_notice', {
      title: input.title,
      body: input.body ?? '',
      linkUrl: this.url('/admin'),
    });
  }

  /** An hourly or daily summary of notifications, one line each. */
  sendStaffSummary(input: { to: string; period: 'hour' | 'day'; lines: string[] }) {
    return this.deliverWithId(input.to, 'staff_summary', {
      period: input.period,
      count: input.lines.length,
      lines: input.lines.join('\n'),
      linkUrl: this.url('/admin'),
    });
  }

  /** The viewer digest (M44-S15). Titles and links only, with one click unsubscribe in the footer and headers. */
  sendViewerDigest(input: {
    to: string;
    period: 'day' | 'week';
    lines: string[];
    unsubscribeToken: string;
  }) {
    return this.deliverWithId(input.to, 'viewer_digest', {
      period: input.period,
      count: input.lines.length,
      lines: input.lines.join('\n'),
      linkUrl: this.url('/notifications'),
      unsubscribeUrl: this.url('/unsubscribe/notices', { token: input.unsubscribeToken }),
    });
  }

  sendStaffExportReady(input: { to: string; name: string; rows: number; hours: number }) {
    return this.deliverWithId(input.to, 'staff_export_ready', {
      name: input.name,
      rows: input.rows,
      hours: input.hours,
      linkUrl: this.url('/admin/exports'),
    });
  }

  sendStaffExportFailed(input: { to: string; name: string }) {
    return this.deliverWithId(input.to, 'staff_export_failed', {
      name: input.name,
      linkUrl: this.url('/admin/exports'),
    });
  }

  sendDonationReceipt(input: {
    to: string;
    reference: string;
    amount: string;
    date: string;
    orgName: string;
    donorName?: string;
    taxNote?: string;
  }) {
    return this.deliverWithId(input.to, 'donation_receipt', {
      reference: input.reference,
      amount: input.amount,
      date: input.date,
      orgName: input.orgName,
      donorName: input.donorName ?? '',
      taxNote: input.taxNote ?? '',
    });
  }
}
