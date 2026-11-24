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
  | 'staff_export_failed';

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
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
  build(v: Record<string, string>, brand: BrandContext): Content;
}

const DEFINITIONS: Record<TemplateName, Definition> = {
  welcome: {
    required: ['homeUrl'],
    links: ['homeUrl'],
    build: (v, b) => ({
      subject: `Welcome to ${b.appName}`,
      intro: [
        `Your email is confirmed and your account on ${b.appName} is ready.`,
        'Pick a profile and start watching.',
      ],
      action: { label: 'Start watching', url: v.homeUrl! },
      outro: ['You can change your playback and caption settings any time from your account.'],
    }),
  },
  verify_email: {
    required: ['code', 'linkUrl'],
    links: ['linkUrl'],
    build: (v, b) => ({
      subject: `Confirm your email for ${b.appName}`,
      intro: ['Enter this code on the verification screen, or use the button below.'],
      code: v.code,
      action: { label: 'Confirm my email', url: v.linkUrl! },
      outro: [
        'The code works for 15 minutes and the button for 24 hours. If you did not create an account, you can ignore this email.',
      ],
    }),
  },
  already_registered: {
    required: ['signInUrl', 'resetUrl'],
    links: ['signInUrl', 'resetUrl'],
    build: (v, b) => ({
      subject: `Someone tried to sign up to ${b.appName} with your email`,
      intro: [
        `Someone tried to create an account on ${b.appName} with this address, but you already have one.`,
        'If it was you, sign in instead. If you forgot your password, you can reset it.',
      ],
      action: { label: 'Sign in', url: v.signInUrl! },
      outro: [
        `Forgot your password? Reset it here: ${v.resetUrl}`,
        'If it was not you, no action is needed.',
      ],
    }),
  },
  reset_password: {
    required: ['linkUrl', 'minutes'],
    links: ['linkUrl'],
    build: (v, b) => ({
      subject: `Reset your ${b.appName} password`,
      intro: [
        'We received a request to reset your password. Use the button below to choose a new one.',
      ],
      action: { label: 'Choose a new password', url: v.linkUrl! },
      outro: [
        `This link works once and expires in ${v.minutes} minutes. If you did not ask for it, you can ignore this email and your password stays the same.`,
      ],
    }),
  },
  password_changed: {
    required: ['signInUrl', 'resetUrl'],
    links: ['signInUrl', 'resetUrl'],
    build: (v, b) => ({
      subject: `Your ${b.appName} password was changed`,
      intro: ['The password for your account was just changed. Other devices were signed out.'],
      action: { label: 'Sign in', url: v.signInUrl! },
      outro: [`If you did not do this, reset your password now: ${v.resetUrl}`],
    }),
  },
  lockout_notice: {
    required: ['resetUrl', 'minutes'],
    links: ['resetUrl'],
    build: (v, b) => ({
      subject: `There were several failed sign-in attempts on ${b.appName}`,
      intro: [
        `We saw several failed sign-in attempts on your account, so sign-in is paused for ${v.minutes} minutes.`,
        'If this was you, wait and try again. If it was not, choose a new password.',
      ],
      action: { label: 'Reset my password', url: v.resetUrl! },
      outro: ['Your current sessions were not signed out.'],
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
    build: (v, b) => ({
      subject: `Confirm your new email for ${b.appName}`,
      intro: [
        'Enter this code in your account settings, or use the button below, to confirm this address.',
      ],
      code: v.code,
      action: { label: 'Confirm this email', url: v.linkUrl! },
      outro: [
        'The change applies only after you confirm. If you did not ask for it, ignore this email.',
      ],
    }),
  },
  email_change_notice: {
    required: ['resetUrl'],
    links: ['resetUrl'],
    build: (v, b) => ({
      subject: `Someone asked to change the email on your ${b.appName} account`,
      intro: [
        'A request was made to move your account to a different email address. Nothing changes until the new address is confirmed.',
      ],
      action: { label: 'Reset my password', url: v.resetUrl! },
      outro: ['If this was you, no action is needed. If not, reset your password now.'],
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
    build: (v, b) => ({
      subject: `Two step verification was reset on your ${b.appName} account`,
      intro: [
        'An administrator reset two step verification on your account after you asked for help, and signed you out everywhere.',
        'You can sign in with your password and turn it on again from Security.',
      ],
      action: { label: 'Sign in', url: v.signInUrl! },
      outro: ['If you did not ask for this, change your password and contact support.'],
    }),
  },
  mfa_enabled: {
    required: ['securityUrl'],
    links: ['securityUrl'],
    build: (v, b) => ({
      subject: `Two step verification is on for your ${b.appName} account`,
      intro: [
        'From now on we will ask for a code from your authenticator app when you sign in.',
        'Keep your backup codes somewhere safe. Each one works once if you lose your phone.',
      ],
      action: { label: 'Open Security', url: v.securityUrl! },
      outro: ['If you did not do this, change your password right away and contact support.'],
    }),
  },
  mfa_disabled: {
    required: ['securityUrl'],
    links: ['securityUrl'],
    build: (v, b) => ({
      subject: `Two step verification was turned off on your ${b.appName} account`,
      intro: [
        'Two step verification is now off and your other devices were signed out.',
        'You can turn it on again any time from Security.',
      ],
      action: { label: 'Open Security', url: v.securityUrl! },
      outro: ['If you did not do this, change your password right away and contact support.'],
    }),
  },
  recovery_codes_low: {
    required: ['remaining', 'securityUrl'],
    links: ['securityUrl'],
    build: (v, b) => ({
      subject: `You are running low on ${b.appName} backup codes`,
      intro: [
        `You have ${v.remaining} backup codes left. Get a new set before you run out so a lost phone does not lock you out.`,
      ],
      action: { label: 'Get new codes', url: v.securityUrl! },
      outro: ['Getting new codes makes every old code stop working.'],
    }),
  },
  recovery_code_used: {
    required: ['remaining', 'securityUrl'],
    links: ['securityUrl'],
    build: (v, b) => ({
      subject: `A backup code was used to sign in to ${b.appName}`,
      intro: [
        `A backup code was just used to sign in to your account. You have ${v.remaining} left.`,
      ],
      action: { label: 'Open Security', url: v.securityUrl! },
      outro: ['If this was not you, change your password right away and contact support.'],
    }),
  },
  new_device_sign_in: {
    required: ['device', 'country', 'time', 'passwordUrl', 'signOutUrl'],
    links: ['passwordUrl', 'signOutUrl'],
    build: (v, b) => ({
      subject: `New sign in to your ${b.appName} account`,
      intro: [
        `We saw a sign in from a device we have not seen before: ${v.device}, ${v.country}, ${v.time}.`,
        'If this was you, no action is needed.',
      ],
      action: { label: 'Not you? Change your password', url: v.passwordUrl! },
      outro: [`Sign out everywhere from Security: ${v.signOutUrl}`],
    }),
  },
  google_linked: {
    required: ['securityUrl'],
    links: ['securityUrl'],
    build: (v, b) => ({
      subject: `Google was linked to your ${b.appName} account`,
      intro: ['You can now sign in with Google as well as your usual method.'],
      action: { label: 'Open Security', url: v.securityUrl! },
      outro: ['If you did not do this, change your password right away and contact support.'],
    }),
  },
  google_unlinked: {
    required: ['securityUrl'],
    links: ['securityUrl'],
    build: (v, b) => ({
      subject: `Google was removed from your ${b.appName} account`,
      intro: ['Google can no longer be used to sign in to your account.'],
      action: { label: 'Open Security', url: v.securityUrl! },
      outro: ['If you did not do this, change your password right away and contact support.'],
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
    build: (_v, b) => ({
      subject: `Your ${b.appName} account was deleted`,
      intro: [
        'Your account, profiles, watch history and list were deleted and cannot be restored.',
        'Backups are cleared within 14 days.',
      ],
      outro: ['Thank you for learning with us.'],
    }),
  },
  export_ready: {
    required: ['linkUrl', 'hours'],
    links: ['linkUrl'],
    build: (v, b) => ({
      subject: `Your ${b.appName} data export is ready`,
      intro: [
        'Your file has your account, profiles, My List and watch progress. It never includes your password.',
      ],
      action: { label: 'Download my data', url: v.linkUrl! },
      outro: [
        `The link works for ${v.hours} hours and needs you to be signed in. If you did not ask for this, change your password.`,
      ],
    }),
  },
  export_failed: {
    required: ['retryUrl'],
    links: ['retryUrl'],
    build: (v, b) => ({
      subject: `We could not build your export on ${b.appName}`,
      intro: ['Something went wrong while building your file. Nothing was lost.'],
      action: { label: 'Try again', url: v.retryUrl! },
      outro: ['If it keeps failing, write to us and we will help.'],
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
  deletion_scheduled: {
    required: ['cancelUrl', 'purgeDate', 'days'],
    links: ['cancelUrl'],
    build: (v, b) => ({
      subject: `Your ${b.appName} account will be deleted on ${v.purgeDate}`,
      intro: [
        `We got your request to delete your account. You were signed out everywhere, and your account will be removed on ${v.purgeDate}, in ${v.days} days.`,
        'To keep it, sign in before then and choose Cancel deletion. Everything comes back as it was.',
      ],
      action: { label: 'Sign in to cancel', url: v.cancelUrl! },
      outro: [
        `After ${v.purgeDate} your profiles, list and watch progress are removed and cannot be restored. If you did not ask for this, sign in and cancel, then change your password.`,
      ],
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

/** Renders one template to a subject, plain text and HTML. Throws TemplateError instead of sending a blank value. */
export function renderTemplate(name: TemplateName, vars: Vars, brand: BrandContext): RenderedMail {
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
  const content = definition.build(values, brand);
  const subject = stripLineBreaks(content.subject);
  return { subject, text: toText(content, brand), html: toHtml(content, brand, subject) };
}

function toText(content: Content, brand: BrandContext): string {
  const lines: string[] = [...content.intro, ''];
  if (content.code) lines.push(`Your code: ${content.code}`, '');
  if (content.action) lines.push(`${content.action.label}: ${content.action.url}`, '');
  lines.push(...content.outro, '', `Need help? Write to ${brand.supportEmail}.`, brand.appName);
  return lines.join('\n');
}

function toHtml(content: Content, brand: BrandContext, subject: string): string {
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
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${muted}">Or open this link: <a href="${url}" style="color:${colour}">${url}</a></p>`,
    );
  }
  parts.push(...content.outro.map(paragraph));
  const support = escapeHtml(brand.supportEmail);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:${page};font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${card};border-radius:12px"><tr><td style="padding:32px">
${
  logo
    ? `<p style="margin:0 0 24px"><img src="${escapeHtml(logo)}" alt="${escapeHtml(brand.appName)}" height="40" style="display:block;height:40px;max-width:240px;width:auto;border:0"></p>`
    : `<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:${colour}">${escapeHtml(brand.appName)}</p>`
}
${parts.join('\n')}
<p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:${muted}">Need help? Write to <a href="mailto:${support}" style="color:${colour}">${support}</a>.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}
