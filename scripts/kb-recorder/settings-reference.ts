/**
 * Builds the settings dictionary article (R04) from the settings registry. The key list, labels, defaults and who
 * may change each setting always come from `packages/theme/src/settings-registry.ts`, so the article cannot drift.
 * The plain words for the few settings whose registry text is too long or too technical live in PLAIN below, and
 * the screen where each setting can be changed lives in `whereIs`. `settings-reference.test.ts` fails when a new
 * registry key has no screen, when the file on disk differs from this output, or when a step is too long.
 *
 * Run `pnpm help:settings` to rewrite the article, `pnpm help:settings --check` to compare only.
 */
import { SETTING_DEFS, SETTING_KEYS, type SettingKey } from '../../packages/theme/src/settings-registry';

export const R04_PATH = 'content/help/en/reference/R04-settings-dictionary.md';

const SITE = 'Site settings';

/** The screen and tab that changes a setting, in the words on the screen. */
export function whereIs(key: SettingKey): string {
  const exact: Partial<Record<SettingKey, string>> = {
    'content.series_labels': `${SITE}, Series names tab`,
    'platform.name': `${SITE}, Platform details tab, and the Theme screen`,
    'features.guest_audience': 'No screen yet. Ask the developer',
    'maturity.labels': 'No screen yet. Ask the developer',
    'maturity.guest_max_rank': 'No screen yet. Ask the developer',
    'help.support_contact': 'No screen yet. Ask the developer',
    'content.ui_languages': 'Changes when a language is published on the Languages screen',
    'content.languages': 'No screen yet. Ask the developer',
    'i18n.publish_min_percent': 'No screen yet. Ask the developer',
    'translation.glossary': 'No screen yet. Ask the developer',
    'legal.terms_version': `Changes by itself when you save a new version in ${SITE}, Pages tab`,
    'legal.privacy_version': `Changes by itself when you save a new version in ${SITE}, Pages tab`,
    'consent.notice_version': `${SITE}, Discovery tab, with the button Show notice again to everyone`,
    'sponsors.enabled': 'Sponsors screen, the master switch card',
    'maintenance.banner': `${SITE}, Maintenance tab`,
    'maintenance.mode': `${SITE}, Maintenance tab`,
  };
  if (exact[key]) return exact[key] as string;
  const g = SETTING_DEFS[key].group;
  if (key.startsWith('trending.')) return 'No screen yet. Ask the developer';
  if (key.startsWith('sponsors.') || key.startsWith('donate.')) return 'No screen yet. Ask the developer';
  if (g === 'platform') return `${SITE}, Platform details tab`;
  if (g === 'features' || g === 'limits' || g === 'analytics' || g === 'audit')
    return `${SITE}, Features and limits tab`;
  if (g === 'home') return `${SITE}, Home tab`;
  if (g === 'discovery') return `${SITE}, Discovery tab`;
  if (g === 'security') return `${SITE}, Security tab`;
  return 'No screen yet. Ask the developer';
}

/** Plain words for settings whose registry text is long or technical. Keep each to 25 words or fewer. */
const PLAIN: Partial<Record<SettingKey, string>> = {
  'security.staff_second_step':
    'After the password, staff enter a code sent by email, or from an authenticator app. Existing apps keep working.',
  'security.staff_session_idle_days':
    'Staff sign in again after this many idle days. Each visit restarts the count. 1 to 30.',
  'security.staff_session_absolute_days':
    'Every staff sign in ends after this many days, however busy. 1 to 90.',
  'security.trusted_device_days':
    'Days a remembered device skips the emailed code. 0 turns Remember this device off. 0 to 90.',
  'home.hero_clip_seconds':
    'How long a hero clip plays, 6 to 30 seconds. Longer videos play their best part.',
  'home.hero_sound':
    'Clips start muted. On adds an Unmute button when the clip has sound. Kids never see it.',
  'home.hero_wait_for_clip':
    'On: a slide with a clip changes when the clip ends. Off: every slide changes on the timer.',
  'home.hero_previews_unknown_connection':
    'Some browsers do not report connection speed. On plays clips for them too. Off keeps their data use low.',
  'home.hero_previews_min_downlink_mbps':
    'Clips play only above this speed in Mbps. Lower it if clips will not play. 1 to 10.',
  'home.hero_previews':
    'Play a short muted clip on the hero for fast connections when Data saver is off.',
  'trending.min_titles':
    'Trending, Top 10 and Most liked stay hidden until this many titles qualify for the viewer.',
  'trending.min_site_plays':
    'Trending stays hidden until the site has this many plays in the latest count.',
  'trending.max_age_hours':
    'A Trending count older than this is treated as empty and the row is hidden.',
  'trending.popular_min_titles':
    'Popular is hidden, or shows the newest titles, until this many titles qualify.',
  'features.signin_with_google':
    'Show Continue with Google on sign in. It also needs the Google keys added by the developer.',
  'features.airplay':
    'Show an AirPlay button on Safari. Turn it on only after a test on a real iPhone and Apple TV.',
  'maturity.guest_max_rank':
    'Place on the rating scale, 0 to 4. The default 2 is the third label.',
  'maturity.labels':
    'Five short labels from lowest to highest, separated by commas, for example G,PG,12,15,18.',
  'features.guest_play':
    'Anyone can watch without an account. Off means guests can browse but must sign in to play.',
  'features.guest_audience':
    'What visitors see before they sign in, General or Kids. They can switch Kids mode on their own device.',
  'content.ui_languages':
    'Languages viewers can pick for menus and text. Only English until another language is published.',
  'limits.guest_segment_minutes':
    'How long a guest video link works before the player renews it. 5 to 120 minutes.',
  'consent.notice_version':
    'Raise this number to show the storage notice again to everyone who already closed it.',
  'consent.notice_enabled':
    'Show the short notice about what the site keeps on a visitor device.',
  'seo.default_social_image_url':
    'The picture shown when someone shares a link. Use a full https link or a path starting with a slash.',
  'donate.retention.event_days':
    'How many days payment records are kept before they are removed.',
  'donate.receipts.reply_to': 'The address donors reply to when they answer a receipt.',
  'sponsors.enabled':
    'The master switch. Sponsor messages never show while this is off, whatever else is set.',
  'donate.enabled':
    'The master switch for donations. The Donate page and links stay hidden while this is off.',
};

function describe(key: SettingKey): string {
  return PLAIN[key] ?? SETTING_DEFS[key].description;
}

const MINOR_AMOUNTS: SettingKey[] = [
  'donate.presets_minor.ngn',
  'donate.presets_minor.usd',
  'donate.min_minor.ngn',
  'donate.max_minor.ngn',
];

/** A default value in plain words. */
export function plainDefault(key: SettingKey): string {
  const v = SETTING_DEFS[key].default as unknown;
  if (key === 'limits.upload_max_bytes') return `${(v as number) / 1024 ** 3} GB`;
  if (key === 'maintenance.banner') return 'Off, with no message';
  if (key === 'security.staff_second_step') return 'Email';
  if (key.startsWith('security.') && typeof v === 'number') return `${v} days`;
  if (key === 'content.series_labels') return 'The ready made set that ships with the site';
  if (MINOR_AMOUNTS.includes(key)) {
    const sym = key.endsWith('usd') ? '$' : '₦';
    const money = (n: number) => `${sym}${(n / 100).toLocaleString('en-GB')}`;
    return Array.isArray(v) ? (v as number[]).map(money).join(', ') : money(v as number);
  }
  if (typeof v === 'boolean') return v ? 'On' : 'Off';
  if (v === '' || v === null) return 'Empty';
  if (Array.isArray(v)) return v.length === 0 ? 'Empty' : v.join(', ');
  if (typeof v === 'number') return String(v);
  return `"${String(v)}"`;
}

const who = (key: SettingKey) =>
  SETTING_DEFS[key].tier === 'super' ? 'Super admins only' : 'Admins and Super admins';

const GROUP_NAMES: Record<string, string> = {
  platform: 'Platform details',
  features: 'Features',
  limits: 'Limits',
  home: 'Home',
  content: 'Languages and content',
  legal: 'Legal pages',
  analytics: 'Numbers',
  audit: 'Audit log',
  maintenance: 'Maintenance',
  monetization: 'Sponsors and donations',
  discovery: 'Discovery and notices',
  security: 'Security',
};

const GROUP_ORDER = [
  'platform',
  'features',
  'limits',
  'home',
  'content',
  'discovery',
  'security',
  'legal',
  'maintenance',
  'analytics',
  'audit',
  'monetization',
];

export function orderedKeys(): SettingKey[] {
  const rank = (k: SettingKey) => GROUP_ORDER.indexOf(SETTING_DEFS[k].group);
  return [...SETTING_KEYS].sort((a, b) => rank(a) - rank(b) || SETTING_KEYS.indexOf(a) - SETTING_KEYS.indexOf(b));
}

const noDash = (s: string) => s.replace(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, 'g'), ', ');

/** One step of R04. The first line is at most 25 words. The indented line carries where, default and who. */
export function stepFor(key: SettingKey): { line: string; note: string } {
  const d = SETTING_DEFS[key];
  const body = noDash(describe(key)).replace(/\.?$/, '.');
  return {
    line: `**${d.label}**: ${body}`,
    note: `Group: ${GROUP_NAMES[d.group]}. Where: ${whereIs(key)}. Default: ${plainDefault(key)}. Who: ${who(key)}.`,
  };
}

export function renderR04(): string {
  const keys = orderedKeys();
  const steps = keys
    .map((k, i) => {
      const s = stepFor(k);
      return `${i + 1}. ${s.line}\n   ${s.note}`;
    })
    .join('\n');
  const count = keys.length;
  return `---
id: R04
title: Settings dictionary
path: reference
summary: Every site setting in plain words, with its default, where to change it and who can.
role: admin
roleNote: Admins change most settings, Super admins change features and limits
needs: [C01]
related: [C04, C05, C10]
readMinutes: 12
screens: []
aliases: [settings, options, switches, defaults, configuration]
dependsOn: [packages/theme/src/settings-registry.ts]
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Look up what any of the ${count} site settings does. You end knowing its default, where to change it and who can change it.

## Before you start
This list is written from the settings list in the platform, so it always has every setting. Most are on **Site settings**. Read [Platform details and the Launch checklist](help:C01) first.

## Steps
${steps}

## What you should see
You know what each setting does and which screen changes it. Where it says No screen yet, ask the developer to change it.

## If something goes wrong
- **A setting is not on the screen.** It may be for Super admins only, or it has no screen yet. Check the Who and Where lines. [Features and limits](help:C04)
- **A change does not show for viewers.** Most changes show within a minute. Wait, then reload the site. [Home and Discovery settings](help:C05)
`;
}
