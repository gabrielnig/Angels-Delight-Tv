import { SmtpTransport, type MailTransport, type OutgoingMail } from './mailer';

/** Waits before attempts 2 to 5 (M21-S01 AC1). Growing, and short enough to run inside a request. */
export const RETRY_DELAYS_MS = [250, 1_000, 3_000, 8_000] as const;

/** Provider outage window before the developer is alerted (M21-S01 Error). */
export const OUTAGE_ALERT_AFTER_MS = 10 * 60_000;

export interface DeliveryMonitor {
  failure(error: unknown): void;
  success(): void;
}

/** Tracks continuous failure. Alerts once per outage, after 10 minutes; a success ends the outage. */
export class OutageMonitor implements DeliveryMonitor {
  private since: number | null = null;
  private alerted = false;
  private readonly now: () => number;
  private readonly alert: (info: { since: Date; error: unknown }) => void;

  constructor(options: {
    now?: () => number;
    alert: (info: { since: Date; error: unknown }) => void;
  }) {
    this.now = options.now ?? Date.now;
    this.alert = options.alert;
  }

  failure(error: unknown): void {
    const now = this.now();
    this.since ??= now;
    if (this.alerted || now - this.since < OUTAGE_ALERT_AFTER_MS) return;
    this.alerted = true;
    try {
      this.alert({ since: new Date(this.since), error });
    } catch {
      // an alert hook must never break sending
    }
  }

  success(): void {
    this.since = null;
    this.alerted = false;
  }
}

/** SMTP 5xx replies are permanent for that address; retrying only delays the answer. */
function isPermanent(error: unknown): boolean {
  if (error instanceof Error && error.name === 'EmailNotConfigured') return true;
  const code = (error as { responseCode?: unknown } | null)?.responseCode;
  return typeof code === 'number' && code >= 500 && code < 600;
}

export interface RetryOptions {
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  monitor?: DeliveryMonitor;
}

/** Retries a transport with backoff up to `attempts` times (default 5), skipping permanent rejections. */
export class RetryingTransport implements MailTransport {
  private readonly attempts: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly inner: MailTransport,
    private readonly options: RetryOptions = {},
  ) {
    this.attempts = options.attempts ?? RETRY_DELAYS_MS.length + 1;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async send(mail: OutgoingMail): Promise<{ messageId: string }> {
    let last: unknown;
    for (let attempt = 0; attempt < this.attempts; attempt += 1) {
      if (attempt > 0) {
        await this.sleep(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]!);
      }
      try {
        const sent = await this.inner.send(mail);
        this.options.monitor?.success();
        return sent;
      } catch (error) {
        last = error;
        if (isPermanent(error)) throw error;
      }
    }
    this.options.monitor?.failure(last);
    throw last;
  }
}

/** The SMTP_URL value that turns sending off for a first deploy without email credentials. */
export const DISABLED_SMTP_URL = 'disabled';

export const EMAIL_NOT_CONFIGURED = 'Email is not configured';

export function isEmailDisabled(smtpUrl: string | undefined): boolean {
  return smtpUrl?.trim().toLowerCase() === DISABLED_SMTP_URL;
}

/** Fails every send. The error name is permanent for the outbox, so rows close as failed instead of retrying. */
export class DisabledTransport implements MailTransport {
  async send(): Promise<{ messageId: string }> {
    throw Object.assign(new Error(`${EMAIL_NOT_CONFIGURED}. Set SMTP_URL to enable sending.`), {
      name: 'EmailNotConfigured',
    });
  }
}

export function transportFromSmtpUrl(smtpUrl: string): MailTransport {
  return isEmailDisabled(smtpUrl) ? new DisabledTransport() : SmtpTransport.fromUrl(smtpUrl);
}
