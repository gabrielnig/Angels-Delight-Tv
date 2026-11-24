import {
  EN_NG,
  createMessages,
  localeInfo,
  type CatalogShape,
  type Translate,
} from '@ad/shared/messages';

export interface BrandContext {
  appName: string;
  supportEmail: string;
  /** Button colour. Configurable, defaults to the banner blue from D-003. */
  primaryColor?: string;
  /** Public web link to the logo. Without it the name is shown as text. */
  logoUrl?: string;
  /** Theme colours. Each must be a hex value, anything else falls back to the default. */
  backgroundColor?: string;
  surfaceColor?: string;
  inkColor?: string;
  mutedColor?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (value: string | undefined, fallback: string): string =>
  value && HEX.test(value) ? value : fallback;

function webUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export type TemplateName =
  | 'verify_email'
  | 'already_registered'
  | 'reset_password'
  | 'password_changed'
  | 'lockout_notice'
  | 'admin_invite'
  | 'email_change_verify'
  | 'email_change_notice'
  | 'two_factor_reset'
  | 'two_factor_reset_viewer'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'recovery_codes_low'
  | 'recovery_code_used'
  | 'new_device_sign_in'
  | 'google_linked'
  | 'google_unlinked'
  | 'staff_lockout_alert'
  | 'welcome'
  | 'account_deleted'
  | 'deletion_scheduled'
  | 'export_ready'
  | 'export_failed'
  | 'staff_notice'
  | 'staff_summary'
  | 'staff_export_ready'
  | 'staff_export_failed'
  | 'viewer_digest'
  | 'donation_receipt';

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
  /** Extra mail headers from the template, for example List-Unsubscribe. */
  headers?: Record<string, string>;
}

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

type Vars = Record<string, string | number | undefined>;

interface Content {
  subject: string;
  intro: string[];
  code?: string;
  action?: { label: string; url: string };
  outro: string[];
}

interface Definition {
  required: string[];
  /** Read when given, left out when empty. */
  optional?: string[];
  links?: string[];
  /** Viewer facing templates read their text through `msg` (keys `mail.*`). Staff templates ignore it. */
  build(v: Record<string, string>, brand: BrandContext, msg: Translate): Content;
  headers?(v: Record<string, string>): Record<string, string>;
}

const DEFINITIONS: Record<TemplateName, Definition> = {
  welcome: {
    required: ['homeUrl'],
    links: ['homeUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.welcome.subject', { appName: b.appName }),
      intro: [msg('mail.welcome.intro1', { appName: b.appName }), msg('mail.welcome.intro2')],
      action: { label: msg('mail.welcome.action'), url: v.homeUrl! },
      outro: [msg('mail.welcome.outro1')],
    }),
  },
  verify_email: {
    required: ['code', 'linkUrl'],
    links: ['linkUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.verify_email.subject', { appName: b.appName }),
      intro: [msg('mail.verify_email.intro1')],
      code: v.code,
      action: { label: msg('mail.verify_email.action'), url: v.linkUrl! },
      outro: [msg('mail.verify_email.outro1')],
    }),
  },
  already_registered: {
    required: ['signInUrl', 'resetUrl'],
    links: ['signInUrl', 'resetUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.already_registered.subject', { appName: b.appName }),
      intro: [
        msg('mail.already_registered.intro1', { appName: b.appName }),
        msg('mail.already_registered.intro2'),
      ],
      action: { label: msg('mail.already_registered.action'), url: v.signInUrl! },
      outro: [
        msg('mail.already_registered.outro1', { resetUrl: v.resetUrl! }),
        msg('mail.already_registered.outro2'),
      ],
    }),
  },
  reset_password: {
    required: ['linkUrl', 'minutes'],
    links: ['linkUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.reset_password.subject', { appName: b.appName }),
      intro: [msg('mail.reset_password.intro1')],
      action: { label: msg('mail.reset_password.action'), url: v.linkUrl! },
      outro: [msg('mail.reset_password.outro1', { minutes: v.minutes! })],
    }),
  },
  password_changed: {
    required: ['signInUrl', 'resetUrl'],
    links: ['signInUrl', 'resetUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.password_changed.subject', { appName: b.appName }),
      intro: [msg('mail.password_changed.intro1')],
      action: { label: msg('mail.password_changed.action'), url: v.signInUrl! },
      outro: [msg('mail.password_changed.outro1', { resetUrl: v.resetUrl! })],
    }),
  },
  lockout_notice: {
    required: ['resetUrl', 'minutes'],
    links: ['resetUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.lockout_notice.subject', { appName: b.appName }),
      intro: [
        msg('mail.lockout_notice.intro1', { minutes: v.minutes! }),
        msg('mail.lockout_notice.intro2'),
      ],
      action: { label: msg('mail.lockout_notice.action'), url: v.resetUrl! },
      outro: [msg('mail.lockout_notice.outro1')],
    }),
  },
  admin_invite: {
    required: ['role', 'linkUrl', 'hours'],
    links: ['linkUrl'],
    build: (v, b) => ({
      subject: `You are invited to help run ${b.appName}`,
      intro: [
        `You have been invited to ${b.appName} as ${v.role}. You will set a password and an authenticator app.`,
      ],
      action: { label: 'Accept the invitation', url: v.linkUrl! },
      outro: [
        `The link works once and expires in ${v.hours} hours. If you were not expecting this, ignore it.`,
      ],
    }),
  },
  email_change_verify: {
    required: ['code', 'linkUrl'],
    links: ['linkUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.email_change_verify.subject', { appName: b.appName }),
      intro: [msg('mail.email_change_verify.intro1')],
      code: v.code,
      action: { label: msg('mail.email_change_verify.action'), url: v.linkUrl! },
      outro: [msg('mail.email_change_verify.outro1')],
    }),
  },
  email_change_notice: {
    required: ['resetUrl'],
    links: ['resetUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.email_change_notice.subject', { appName: b.appName }),
      intro: [msg('mail.email_change_notice.intro1')],
      action: { label: msg('mail.email_change_notice.action'), url: v.resetUrl! },
      outro: [msg('mail.email_change_notice.outro1')],
    }),
  },
  two_factor_reset: {
    required: ['signInUrl'],
    links: ['signInUrl'],
    build: (v, b) => ({
      subject: `Your ${b.appName} two factor sign-in was reset`,
      intro: [
        'A Super admin reset the authenticator on your staff account and ended your sessions. You will set up a new authenticator the next time you sign in.',
      ],
      action: { label: 'Sign in', url: v.signInUrl! },
      outro: ['If you did not expect this, contact the person who manages your team.'],
    }),
  },
  two_factor_reset_viewer: {
    required: ['signInUrl'],
    links: ['signInUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.two_factor_reset_viewer.subject', { appName: b.appName }),
      intro: [
        msg('mail.two_factor_reset_viewer.intro1'),
        msg('mail.two_factor_reset_viewer.intro2'),
      ],
      action: { label: msg('mail.two_factor_reset_viewer.action'), url: v.signInUrl! },
      outro: [msg('mail.two_factor_reset_viewer.outro1')],
    }),
  },
  mfa_enabled: {
    required: ['securityUrl'],
    links: ['securityUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.mfa_enabled.subject', { appName: b.appName }),
      intro: [msg('mail.mfa_enabled.intro1'), msg('mail.mfa_enabled.intro2')],
      action: { label: msg('mail.mfa_enabled.action'), url: v.securityUrl! },
      outro: [msg('mail.mfa_enabled.outro1')],
    }),
  },
  mfa_disabled: {
    required: ['securityUrl'],
    links: ['securityUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.mfa_disabled.subject', { appName: b.appName }),
      intro: [msg('mail.mfa_disabled.intro1'), msg('mail.mfa_disabled.intro2')],
      action: { label: msg('mail.mfa_disabled.action'), url: v.securityUrl! },
      outro: [msg('mail.mfa_disabled.outro1')],
    }),
  },
  recovery_codes_low: {
    required: ['remaining', 'securityUrl'],
    links: ['securityUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.recovery_codes_low.subject', { appName: b.appName }),
      intro: [msg('mail.recovery_codes_low.intro1', { remaining: v.remaining! })],
      action: { label: msg('mail.recovery_codes_low.action'), url: v.securityUrl! },
      outro: [msg('mail.recovery_codes_low.outro1')],
    }),
  },
  recovery_code_used: {
    required: ['remaining', 'securityUrl'],
    links: ['securityUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.recovery_code_used.subject', { appName: b.appName }),
      intro: [msg('mail.recovery_code_used.intro1', { remaining: v.remaining! })],
      action: { label: msg('mail.recovery_code_used.action'), url: v.securityUrl! },
      outro: [msg('mail.recovery_code_used.outro1')],
    }),
  },
  new_device_sign_in: {
    required: ['device', 'country', 'time', 'passwordUrl', 'signOutUrl'],
    links: ['passwordUrl', 'signOutUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.new_device_sign_in.subject', { appName: b.appName }),
      intro: [
        msg('mail.new_device_sign_in.intro1', {
          device: v.device!,
          country: v.country!,
          time: v.time!,
        }),
        msg('mail.new_device_sign_in.intro2'),
      ],
      action: { label: msg('mail.new_device_sign_in.action'), url: v.passwordUrl! },
      outro: [msg('mail.new_device_sign_in.outro1', { signOutUrl: v.signOutUrl! })],
    }),
  },
  google_linked: {
    required: ['securityUrl'],
    links: ['securityUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.google_linked.subject', { appName: b.appName }),
      intro: [msg('mail.google_linked.intro1')],
      action: { label: msg('mail.google_linked.action'), url: v.securityUrl! },
      outro: [msg('mail.google_linked.outro1')],
    }),
  },
  google_unlinked: {
    required: ['securityUrl'],
    links: ['securityUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.google_unlinked.subject', { appName: b.appName }),
      intro: [msg('mail.google_unlinked.intro1')],
      action: { label: msg('mail.google_unlinked.action'), url: v.securityUrl! },
      outro: [msg('mail.google_unlinked.outro1')],
    }),
  },
  staff_lockout_alert: {
    required: ['account', 'minutes'],
    build: (v, b) => ({
      subject: `A staff account on ${b.appName} was locked`,
      intro: [
        `The staff account ${v.account} was locked for ${v.minutes} minutes after several failed sign-in attempts.`,
        'No action is needed unless you did not expect this. If you did not, check the audit log.',
      ],
      outro: ['Existing sessions of that account were not ended.'],
    }),
  },
  account_deleted: {
    required: [],
    build: (_v, b, msg) => ({
      subject: msg('mail.account_deleted.subject', { appName: b.appName }),
      intro: [msg('mail.account_deleted.intro1'), msg('mail.account_deleted.intro2')],
      outro: [msg('mail.account_deleted.outro1')],
    }),
  },
  export_ready: {
    required: ['linkUrl', 'hours'],
    links: ['linkUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.export_ready.subject', { appName: b.appName }),
      intro: [msg('mail.export_ready.intro1')],
      action: { label: msg('mail.export_ready.action'), url: v.linkUrl! },
      outro: [msg('mail.export_ready.outro1', { hours: v.hours! })],
    }),
  },
  export_failed: {
    required: ['retryUrl'],
    links: ['retryUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.export_failed.subject', { appName: b.appName }),
      intro: [msg('mail.export_failed.intro1')],
      action: { label: msg('mail.export_failed.action'), url: v.retryUrl! },
      outro: [msg('mail.export_failed.outro1')],
    }),
  },
  staff_notice: {
    required: ['title', 'linkUrl'],
    optional: ['body'],
    links: ['linkUrl'],
    build: (v, b) => ({
      subject: `${v.title}`,
      intro: [v.title!, ...(v.body ? [v.body] : [])],
      action: { label: 'Open notifications', url: v.linkUrl! },
      outro: [`You get this because of your notification settings on ${b.appName}.`],
    }),
  },
  viewer_digest: {
    required: ['period', 'count', 'lines', 'linkUrl', 'unsubscribeUrl'],
    links: ['linkUrl', 'unsubscribeUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.viewer_digest.subject', {
        appName: b.appName,
        count: v.count === '1' ? 1 : 2,
        period:
          v.period === 'week' ? msg('mail.viewer_digest.week') : msg('mail.viewer_digest.day'),
      }),
      intro: v.lines!.split('\n').filter((line) => line.trim() !== ''),
      action: { label: msg('mail.viewer_digest.action'), url: v.linkUrl! },
      outro: [
        msg('mail.viewer_digest.outro1', {
          frequency:
            v.period === 'week'
              ? msg('mail.viewer_digest.weekly')
              : msg('mail.viewer_digest.daily'),
          appName: b.appName,
        }),
        msg('mail.viewer_digest.outro2', { unsubscribeUrl: v.unsubscribeUrl! }),
      ],
    }),
    headers: (v) => ({
      'List-Unsubscribe': `<${v.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }),
  },
  staff_summary: {
    required: ['period', 'count', 'lines', 'linkUrl'],
    links: ['linkUrl'],
    build: (v, b) => ({
      subject: `${v.count} ${v.count === '1' ? 'update' : 'updates'} on ${b.appName} this ${v.period}`,
      intro: v.lines!.split('\n').filter((line) => line.trim() !== ''),
      action: { label: 'Open notifications', url: v.linkUrl! },
      outro: [`You get this summary because of your notification settings on ${b.appName}.`],
    }),
  },
  staff_export_ready: {
    required: ['name', 'rows', 'hours', 'linkUrl'],
    links: ['linkUrl'],
    build: (v, b) => ({
      subject: `Your ${v.name} export is ready on ${b.appName}`,
      intro: [`Your ${v.name} file has ${v.rows} rows and is ready to download.`],
      action: { label: 'Download the file', url: v.linkUrl! },
      outro: [
        `The file is kept for ${v.hours} hours and the link needs you to be signed in as the person who asked for it.`,
      ],
    }),
  },
  staff_export_failed: {
    required: ['name', 'linkUrl'],
    links: ['linkUrl'],
    build: (v, b) => ({
      subject: `We could not build your ${v.name} export on ${b.appName}`,
      intro: ['Something went wrong while building your file. Nothing was lost.'],
      action: { label: 'Try again', url: v.linkUrl! },
      outro: ['If it keeps failing, tell the developer.'],
    }),
  },
  donation_receipt: {
    required: ['reference', 'amount', 'date', 'orgName'],
    links: [],
    build: (v, b) => ({
      subject: `Your receipt from ${v.orgName}`,
      intro: [
        v.donorName ? `Thank you, ${v.donorName}.` : 'Thank you for your gift.',
        `We received ${v.amount} on ${v.date}. Reference: ${v.reference}.`,
      ],
      outro: [
        v.taxNote
          ? String(v.taxNote)
          : `Keep this email as your record. Questions? Write to ${b.supportEmail}.`,
      ],
    }),
  },
  deletion_scheduled: {
    required: ['cancelUrl', 'purgeDate', 'days'],
    links: ['cancelUrl'],
    build: (v, b, msg) => ({
      subject: msg('mail.deletion_scheduled.subject', {
        appName: b.appName,
        purgeDate: v.purgeDate!,
      }),
      intro: [
        msg('mail.deletion_scheduled.intro1', { purgeDate: v.purgeDate!, days: v.days! }),
        msg('mail.deletion_scheduled.intro2'),
      ],
      action: { label: msg('mail.deletion_scheduled.action'), url: v.cancelUrl! },
      outro: [msg('mail.deletion_scheduled.outro1', { purgeDate: v.purgeDate! })],
    }),
  },
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripLineBreaks = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();

/** Staff mail stays English: admin screens and staff mail are outside the translation scope (L7-D5). */
const ENGLISH_ONLY = new Set<TemplateName>([
  'admin_invite',
  'two_factor_reset',
  'staff_lockout_alert',
  'staff_notice',
  'staff_summary',
  'staff_export_ready',
  'staff_export_failed',
]);

export interface RenderOptions {
  /** The recipient's locale, for example accounts.locale. Missing or unknown means English. */
  locale?: string;
  /** The effective catalog for that locale. Keys it lacks fall back to English one by one. */
  catalog?: CatalogShape;
}

/**
 * Renders one template to a subject, plain text and HTML. Throws TemplateError instead of sending a blank value.
 * With `options` the viewer facing templates read their text from the locale's catalog and fall back to English
 * per key (M46-S18).
 */
export function renderTemplate(
  name: TemplateName,
  vars: Vars,
  brand: BrandContext,
  options: RenderOptions = {},
): RenderedMail {
  const info = ENGLISH_ONLY.has(name) ? undefined : localeInfo(options.locale ?? 'en');
  const locale = info?.code ?? 'en';
  const msg = createMessages(
    locale,
    { 'en-NG': EN_NG as unknown as CatalogShape, [locale]: options.catalog ?? {} },
    () => undefined,
  );
  const htmlLang = locale === 'en' ? 'en' : (info?.htmlLang ?? locale);
  const definition = DEFINITIONS[name];
  const values: Record<string, string> = {};
  for (const key of definition.required) {
    const raw = vars[key];
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      throw new TemplateError(`Template ${name} is missing ${key}`);
    }
    values[key] = String(raw);
  }
  for (const key of definition.optional ?? []) {
    const raw = vars[key];
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') values[key] = String(raw);
  }
  for (const key of definition.links ?? []) {
    const protocol = new URL(values[key]!).protocol;
    if (protocol !== 'https:' && protocol !== 'http:') {
      throw new TemplateError(`Template ${name} got a non web link for ${key}`);
    }
  }
  const content = definition.build(values, brand, msg);
  const subject = stripLineBreaks(content.subject);
  const headers = definition.headers?.(values);
  return {
    subject,
    text: toText(content, brand, msg),
    html: toHtml(content, brand, subject, msg, htmlLang),
    ...(headers ? { headers } : {}),
  };
}

function toText(content: Content, brand: BrandContext, msg: Translate): string {
  const lines: string[] = [...content.intro, ''];
  if (content.code) lines.push(msg('mail.common.code', { code: content.code }), '');
  if (content.action) lines.push(`${content.action.label}: ${content.action.url}`, '');
  lines.push(
    ...content.outro,
    '',
    msg('mail.common.help', { email: brand.supportEmail }),
    brand.appName,
  );
  return lines.join('\n');
}

/** Escapes a translated sentence and puts a link where its `{token}` stands. */
function withLink(text: string, token: string, link: string): string {
  return escapeHtml(text).replace(token, link);
}

function toHtml(
  content: Content,
  brand: BrandContext,
  subject: string,
  msg: Translate,
  htmlLang: string,
): string {
  const colour = hex(brand.primaryColor, '#1F6FB5');
  const page = hex(brand.backgroundColor, '#F5F5F2');
  const card = hex(brand.surfaceColor, '#FFFFFF');
  const ink = hex(brand.inkColor, '#1A1C22');
  const muted = hex(brand.mutedColor, '#5B606B');
  const logo = webUrl(brand.logoUrl);
  const paragraph = (text: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${ink}">${escapeHtml(text)}</p>`;
  const parts: string[] = content.intro.map(paragraph);
  if (content.code) {
    parts.push(
      `<p style="margin:8px 0 24px;font-size:32px;font-weight:700;letter-spacing:8px;color:${ink}">${escapeHtml(content.code)}</p>`,
    );
  }
  if (content.action) {
    const url = escapeHtml(content.action.url);
    parts.push(
      `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 16px"><tr><td style="background:${colour};border-radius:8px"><a href="${url}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none">${escapeHtml(content.action.label)}</a></td></tr></table>`,
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${muted}">${withLink(msg('mail.common.orOpen', { url: '@@' }), '@@', `<a href="${url}" style="color:${colour}">${url}</a>`)}</p>`,
    );
  }
  parts.push(...content.outro.map(paragraph));
  const support = escapeHtml(brand.supportEmail);
  return `<!doctype html>
<html lang="${htmlLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:${page};font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${card};border-radius:12px"><tr><td style="padding:32px">
${
  logo
    ? `<p style="margin:0 0 24px"><img src="${escapeHtml(logo)}" alt="${escapeHtml(brand.appName)}" height="40" style="display:block;height:40px;max-width:240px;width:auto;border:0"></p>`
    : `<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:${colour}">${escapeHtml(brand.appName)}</p>`
}
${parts.join('\n')}
<p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:${muted}">${withLink(msg('mail.common.help', { email: '@@' }), '@@', `<a href="mailto:${support}" style="color:${colour}">${support}</a>`)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}
