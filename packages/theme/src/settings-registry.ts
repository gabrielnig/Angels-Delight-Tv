import { DEFAULT_SERIES_LABELS, parseMaturityLabels, validateSeriesLabels, type SeriesLabelSetting } from '@ad/shared';
import { z } from 'zod';
import { DISCOVERY_DEFS } from './settings-discovery';
import { MONETIZATION_DEFS } from './settings-monetization';

/**
 * Typed registry of every key in the `settings` table (docs/DATA-MODEL.md 8.2, M29).
 * Each key has a schema, a safe default (used when the row is missing or unreadable), whether the value is
 * exposed to the browser, and which tier may change it. Secrets are never stored here.
 */

const text = (max: number) => z.string().trim().max(max);
const bool = z.boolean();
const int = (min: number, max: number) => z.number().int().min(min).max(max);

const hostname = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .refine(
    (value) =>
      value === '' || /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(value),
    {
      message: 'Enter a domain such as angelsdelight.tv, without https://',
    },
  );

const email = z
  .string()
  .trim()
  .max(254)
  .refine((value) => value === '' || /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(value), {
    message: 'Enter a valid email address',
  });

/** Where staff reach the developer from the help centre: an email address or an https link, or empty. */
const supportContact = z
  .string()
  .trim()
  .max(300)
  .refine(
    (value) => {
      if (value === '') return true;
      if (/^[^\s@<>"':/]+@[^\s@<>"':/]+\.[^\s@<>"':/]{2,}$/.test(value)) return true;
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Enter an email address or a full https:// link' },
  );

const language = z
  .string()
  .trim()
  .regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, 'Use a language code such as en or yo');

const socialLink = z.object({
  label: z.string().trim().min(1).max(30),
  url: z
    .string()
    .trim()
    .max(300)
    .refine((value) => {
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Use a full https:// link'),
});

const maintenanceBanner = z.object({
  enabled: bool,
  message: text(200),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
});

/** Series group and item names (M51). Words are validated by the shared helper so one rule serves every caller. */
const seriesLabels = z
  .custom<SeriesLabelSetting>((value) => {
    const result = validateSeriesLabels(value);
    return result.ok && result.value !== null;
  }, 'Choose a name set and check each word')
  .transform((value) => {
    const result = validateSeriesLabels(value);
    return result.ok && result.value ? result.value : DEFAULT_SERIES_LABELS;
  });

export type SettingTier = 'admin' | 'super';
export type SettingGroup =
  'platform' | 'features' | 'limits' | 'content' | 'legal' | 'analytics' | 'audit' | 'maintenance' | 'monetization' | 'home' | 'discovery' | 'security';

interface Def<S extends z.ZodType> {
  schema: S;
  default: z.infer<S>;
  isPublic: boolean;
  tier: SettingTier;
  group: SettingGroup;
  label: string;
  description: string;
}

function def<S extends z.ZodType>(value: Def<S>): Def<S> {
  return value;
}

const GIB = 1024 ** 3;

export const SETTING_DEFS = {
  'platform.name': def({
    schema: text(60).min(1, 'Platform name is required'),
    default: 'Angels Delight TV',
    isPublic: true,
    tier: 'admin',
    group: 'platform',
    label: 'Platform name',
    description: 'Shown in the header, page titles, emails and the app name',
  }),
  'platform.tagline': def({
    schema: text(120),
    default: '',
    isPublic: true,
    tier: 'admin',
    group: 'platform',
    label: 'Tagline',
    description: 'One short line under the name',
  }),
  'platform.canonical_host': def({
    schema: hostname,
    default: '',
    isPublic: false,
    tier: 'admin',
    group: 'platform',
    label: 'Domain',
    description: 'The public domain, without https://',
  }),
  'platform.support_email': def({
    schema: email,
    default: '',
    isPublic: true,
    tier: 'admin',
    group: 'platform',
    label: 'Support email',
    description: 'Where viewers can reach you',
  }),
  'help.support_contact': def({
    schema: supportContact,
    default: '',
    isPublic: false,
    tier: 'admin',
    group: 'platform',
    label: 'Help centre contact',
    description:
      'Email address or https link staff use to message the developer from the help centre. Leave empty to show a placeholder',
  }),
  'platform.footer_text': def({
    schema: text(200),
    default: '',
    isPublic: true,
    tier: 'admin',
    group: 'platform',
    label: 'Footer text',
    description: 'Shown at the bottom of every page',
  }),
  'platform.social_links': def({
    schema: z.array(socialLink).max(6),
    default: [] as { label: string; url: string }[],
    isPublic: true,
    tier: 'admin',
    group: 'platform',
    label: 'Social links',
    description: 'Up to six links',
  }),
  'features.signups_open': def({
    schema: bool,
    default: true,
    isPublic: true,
    tier: 'super',
    group: 'features',
    label: 'Open sign up',
    description: 'Anyone can create an account. Off means invite code only.',
  }),
  'features.kids_profiles': def({
    schema: bool,
    default: true,
    isPublic: true,
    tier: 'super',
    group: 'features',
    label: 'Kids profiles',
    description: 'Viewers can create kids profiles',
  }),
  'features.my_list': def({
    schema: bool,
    default: true,
    isPublic: true,
    tier: 'super',
    group: 'features',
    label: 'My List',
    description: 'Viewers can save titles to My List',
  }),
  'features.guest_play': def({
    schema: bool,
    default: true,
    isPublic: true,
    tier: 'super',
    group: 'features',
    label: 'Guests can watch',
    description:
      'Anyone can watch without an account. Off means guests can browse but must sign in to play.',
  }),
  'features.guest_audience': def({
    schema: z.enum(['general', 'kids']),
    default: 'general' as 'general' | 'kids',
    isPublic: true,
    tier: 'admin',
    group: 'features',
    label: 'Default for visitors without an account',
    description:
      'Choose what visitors see before they sign in. They can switch Kids mode on or off on their own device.',
  }),
  'maturity.labels': def({
    schema: z
      .string()
      .trim()
      .refine((value) => parseMaturityLabels(value) !== null, 'Use five different labels of 1 to 4 characters'),
    default: 'G,PG,12,15,18',
    isPublic: true,
    tier: 'admin',
    group: 'features',
    label: 'Maturity rating labels',
    description:
      'Five short labels from lowest to highest, separated by commas. For example G,PG,12,15,18 or All,7+,13+,16+,18+.',
  }),
  'maturity.guest_max_rank': def({
    schema: int(0, 4),
    default: 2,
    isPublic: false,
    tier: 'admin',
    group: 'features',
    label: 'Highest rating visitors without an account can see',
    description: 'Position on the rating scale, from 0 (the first label) to 4 (the last). The default 2 is the third label.',
  }),
  'features.autoplay_hero': def({
    schema: bool,
    default: true,
    isPublic: true,
    tier: 'super',
    group: 'features',
    label: 'Auto rotate hero',
    description: 'Hero slides change by themselves',
  }),
  'home.hero_interval_seconds': def({
    schema: int(5, 60),
    default: 20,
    isPublic: true,
    tier: 'admin',
    group: 'home',
    label: 'Seconds per hero slide',
    description: 'How long each hero slide stays, from 5 to 60 seconds',
  }),
  'home.hero_wait_for_clip': def({
    schema: bool,
    default: true,
    isPublic: true,
    tier: 'admin',
    group: 'home',
    label: 'Slide waits for its clip',
    description:
      'A slide with a playing clip changes when the clip ends. Off: every slide changes after the seconds above, even while its clip is still playing.',
  }),
  'home.hero_clip_seconds': def({
    schema: int(6, 30),
    default: 20,
    isPublic: false,
    tier: 'admin',
    group: 'home',
    label: 'Seconds per hero clip',
    description:
      'A video this long or shorter plays whole. A longer one plays this many seconds from its best part. 6 to 30. Applies to clips made after the change, use Generate previews for all videos to cut the rest again.',
  }),
  'home.hero_sound': def({
    schema: bool,
    default: true,
    isPublic: true,
    tier: 'admin',
    group: 'home',
    label: 'Sound button on hero clips',
    description:
      'Clips always start muted. On shows an Unmute button beside Pause when the clip has sound. Never shown to kids, or when the device asks for reduced motion.',
  }),
  'home.hero_max_loops': def({
    schema: int(0, 5),
    default: 2,
    isPublic: true,
    tier: 'admin',
    group: 'home',
    label: 'Hero loops before it stops',
    description: 'The hero stops after this many full rounds. 0 means it never stops.',
  }),
  'home.hero_previews': def({
    schema: bool,
    default: true,
    isPublic: true,
    tier: 'admin',
    group: 'home',
    label: 'Hero preview clips',
    description: 'Play a short muted clip on the hero for fast connections with Data saver off',
  }),
  'home.hero_previews_unknown_connection': def({
    schema: bool,
    default: true,
    isPublic: true,
    tier: 'super',
    group: 'home',
    label: 'Preview clips on unknown connections',
    description:
      'Safari and Firefox do not report connection speed. On plays clips for them too (Data saver still stops it). Off keeps their data use low.',
  }),
  'home.hero_previews_min_downlink_mbps': def({
    schema: int(1, 10),
    default: 2,
    isPublic: true,
    tier: 'admin',
    group: 'home',
    label: 'Slowest link that plays clips (Mbps)',
    description:
      'Clips only play when the browser reports at least this speed. Lower it if clips do not play on a slower connection. 1 to 10.',
  }),
  'home.hero_fallback_count': def({
    schema: int(1, 5),
    default: 5,
    isPublic: false,
    tier: 'admin',
    group: 'home',
    label: 'Newest titles in the hero',
    description: 'How many of the newest titles show when no hero titles are chosen',
  }),
  'home.view_all_label': def({
    schema: text(24).min(1, 'Enter a label'),
    default: 'View all',
    isPublic: true,
    tier: 'admin',
    group: 'home',
    label: 'View all label',
    description: 'The link beside a row title',
  }),
  'home.continue_title': def({
    schema: text(40).min(1, 'Enter a title'),
    default: 'Continue learning',
    isPublic: true,
    tier: 'admin',
    group: 'home',
    label: 'Continue row title',
    description: 'The title of the row of titles a viewer has started',
  }),
  'trending.min_titles': def({
    schema: int(1, 50),
    default: 5,
    isPublic: false,
    tier: 'admin',
    group: 'home',
    label: 'Titles Trending needs',
    description: 'Trending, Top 10 and Most liked stay hidden until this many titles qualify for the viewer',
  }),
  'trending.min_site_plays': def({
    schema: int(0, 100000),
    default: 50,
    isPublic: false,
    tier: 'admin',
    group: 'home',
    label: 'Plays Trending needs',
    description: 'Trending stays hidden until the site has this many plays in the latest snapshot',
  }),
  'trending.max_age_hours': def({
    schema: int(1, 72),
    default: 3,
    isPublic: false,
    tier: 'admin',
    group: 'home',
    label: 'Hours before Trending is stale',
    description: 'A trending snapshot older than this is treated as empty and the row is hidden',
  }),
  'trending.top_ten_size': def({
    schema: int(3, 10),
    default: 10,
    isPublic: false,
    tier: 'admin',
    group: 'home',
    label: 'Titles in Top 10',
    description: 'How many numbered titles the Top 10 row shows',
  }),
  'trending.popular_window_days': def({
    schema: int(1, 365),
    default: 30,
    isPublic: false,
    tier: 'admin',
    group: 'home',
    label: 'Days Popular looks back',
    description: 'Popular counts views over this many days',
  }),
  'trending.popular_min_views': def({
    schema: int(1, 1000),
    default: 5,
    isPublic: false,
    tier: 'admin',
    group: 'home',
    label: 'Views a title needs for Popular',
    description: 'A title needs this many views in the window to count as popular',
  }),
  'trending.popular_min_titles': def({
    schema: int(1, 20),
    default: 3,
    isPublic: false,
    tier: 'admin',
    group: 'home',
    label: 'Titles Popular needs',
    description: 'Popular is hidden, or falls back to newest, until this many titles qualify',
  }),
  'features.data_saver_default': def({
    schema: bool,
    default: false,
    isPublic: true,
    tier: 'super',
    group: 'features',
    label: 'Data saver by default',
    description: 'New viewers start with data saver on',
  }),
  'features.require_approved_captions': def({
    schema: bool,
    default: true,
    isPublic: false,
    tier: 'super',
    group: 'features',
    label: 'Require approved captions',
    description: 'A video needs approved captions before it can be published',
  }),
  'features.captions_default_available': def({
    schema: bool,
    default: true,
    isPublic: false,
    tier: 'super',
    group: 'features',
    label: 'Captions are available to viewers by default',
    description: 'Videos that follow the site default offer captions. Each video can override this.',
  }),
  'features.airplay': def({
    schema: bool,
    default: false,
    isPublic: false,
    tier: 'super',
    group: 'features',
    label: 'AirPlay button',
    description:
      'Show an AirPlay button on Safari. Turn on only after it has been tried on a real iPhone and Apple TV.',
  }),
  'features.signin_with_google': def({
    schema: bool,
    default: true,
    isPublic: false,
    tier: 'super',
    group: 'features',
    label: 'Sign in with Google',
    description:
      'Show Continue with Google on Sign in and Sign up. It appears only when the Google keys are also set on the server.',
  }),
  'limits.max_profiles': def({
    schema: int(1, 10),
    default: 5,
    isPublic: false,
    tier: 'super',
    group: 'limits',
    label: 'Profiles per account',
    description: 'Between 1 and 10',
  }),
  'limits.max_sessions': def({
    schema: int(1, 10),
    default: 5,
    isPublic: false,
    tier: 'super',
    group: 'limits',
    label: 'Sessions per account',
    description: 'Between 1 and 10',
  }),
  'limits.upload_max_bytes': def({
    schema: int(10 * 1024 * 1024, 5 * GIB),
    default: 5 * GIB,
    isPublic: false,
    tier: 'super',
    group: 'limits',
    label: 'Upload size limit',
    description: 'Between 10 MB and 5 GB per file',
  }),
  'limits.guest_segment_minutes': def({
    schema: int(5, 120),
    default: 20,
    isPublic: false,
    tier: 'super',
    group: 'limits',
    label: 'Guest video link minutes',
    description: 'How long a guest video link works before the player renews it. Between 5 and 120',
  }),
  'limits.lockout_attempts': def({
    schema: int(3, 20),
    default: 5,
    isPublic: false,
    tier: 'super',
    group: 'limits',
    label: 'Failed sign ins before lockout',
    description: 'Between 3 and 20',
  }),
  'limits.lockout_minutes': def({
    schema: int(1, 1440),
    default: 15,
    isPublic: false,
    tier: 'super',
    group: 'limits',
    label: 'Lockout minutes',
    description: 'Between 1 and 1440',
  }),
  'playback.finish_percent': def({
    schema: int(80, 100),
    default: 95,
    isPublic: false,
    tier: 'super',
    group: 'limits',
    label: 'Finished at percent',
    description: 'A video counts as finished at this share watched',
  }),
  'playback.start_threshold_seconds': def({
    schema: int(0, 60),
    default: 5,
    isPublic: false,
    tier: 'super',
    group: 'limits',
    label: 'Start threshold seconds',
    description: 'Under this, a video starts from the beginning',
  }),
  'playback.rewind_seconds': def({
    schema: int(0, 30),
    default: 3,
    isPublic: false,
    tier: 'super',
    group: 'limits',
    label: 'Rewind on resume seconds',
    description: 'Resume this many seconds earlier',
  }),
  'playback.countdown_seconds': def({
    schema: int(5, 10),
    default: 5,
    isPublic: false,
    tier: 'super',
    group: 'limits',
    label: 'Next video countdown seconds',
    description: 'How long the next video waits before it starts by itself. Between 5 and 10',
  }),
  'content.default_language': def({
    schema: language,
    default: 'en',
    isPublic: true,
    tier: 'admin',
    group: 'content',
    label: 'Default language',
    description: 'Language of captions and the interface',
  }),
  'content.languages': def({
    schema: z.array(language).min(1).max(12),
    default: ['en'],
    isPublic: true,
    tier: 'admin',
    group: 'content',
    label: 'Caption languages',
    description: 'Languages offered for captions',
  }),
  'content.ui_languages': def({
    schema: z.array(z.enum(['en', 'yo', 'ig', 'ha', 'pcm'])).min(1).max(5),
    default: ['en'],
    isPublic: true,
    tier: 'admin',
    group: 'content',
    label: 'Interface languages',
    description: 'Languages viewers can pick for menus and text. Only English until a language is published',
  }),
  'content.series_labels': def({
    schema: seriesLabels,
    default: DEFAULT_SERIES_LABELS,
    isPublic: true,
    tier: 'admin',
    group: 'content',
    label: 'Series group and item names',
    description: 'Choose a ready made name set or type your own words. A series can override this',
  }),
  'i18n.publish_min_percent': def({
    schema: int(0, 100),
    default: 80,
    isPublic: false,
    tier: 'admin',
    group: 'content',
    label: 'Language publish threshold percent',
    description: 'Share of core text that must be approved before a language can go live',
  }),
  'translation.glossary': def({
    schema: text(4096),
    default: '',
    isPublic: false,
    tier: 'admin',
    group: 'content',
    label: 'Translation glossary',
    description: 'Names and terms kept as written in caption translations, one per line',
  }),
  'legal.terms_version': def({
    schema: text(40),
    default: 'v0',
    isPublic: true,
    tier: 'admin',
    group: 'legal',
    label: 'Terms version',
    description: 'Changes when the terms page is published',
  }),
  'legal.privacy_version': def({
    schema: text(40),
    default: 'v0',
    isPublic: true,
    tier: 'admin',
    group: 'legal',
    label: 'Privacy version',
    description: 'Changes when the privacy page is published',
  }),
  'analytics.raw_retention_days': def({
    schema: int(7, 730),
    default: 90,
    isPublic: false,
    tier: 'super',
    group: 'analytics',
    label: 'Raw view event retention (days)',
    description: 'Between 7 and 730',
  }),
  'audit.retention_months': def({
    schema: int(6, 120),
    default: 24,
    isPublic: false,
    tier: 'super',
    group: 'audit',
    label: 'Audit log retention (months)',
    description: 'Between 6 and 120. Older entries are purged monthly',
  }),
  'security.staff_second_step': def({
    schema: z.enum(['email', 'authenticator']),
    default: 'email' as 'email' | 'authenticator',
    isPublic: false,
    tier: 'super',
    group: 'security',
    label: 'Staff second sign in step',
    description:
      'After the password, staff enter a code. Email: the code is mailed to them. Authenticator: they set up an authenticator app. Anyone who already has an app keeps using it.',
  }),
  'security.staff_session_idle_days': def({
    schema: int(1, 30),
    default: 7,
    isPublic: false,
    tier: 'super',
    group: 'security',
    label: 'Days before an idle staff sign in ends',
    description: 'A staff member who does nothing for this many days must sign in again. Each visit restarts the count. 1 to 30.',
  }),
  'security.staff_session_absolute_days': def({
    schema: int(1, 90),
    default: 30,
    isPublic: false,
    tier: 'super',
    group: 'security',
    label: 'Days before every staff sign in ends',
    description: 'A staff sign in always ends after this many days, however busy it was. 1 to 90.',
  }),
  'security.trusted_device_days': def({
    schema: int(0, 90),
    default: 30,
    isPublic: false,
    tier: 'super',
    group: 'security',
    label: 'Days a remembered device skips the emailed code',
    description:
      'Staff can tick Remember this device on the code step. 0 turns the option off. A password or fresh code is still needed for sensitive actions. 0 to 90.',
  }),
  'maintenance.banner': def({
    schema: maintenanceBanner,
    default: { enabled: false, message: '', startsAt: null, endsAt: null } as z.infer<
      typeof maintenanceBanner
    >,
    isPublic: true,
    tier: 'admin',
    group: 'maintenance',
    label: 'Notice banner',
    description: 'A slim notice shown on every page',
  }),
  'maintenance.mode': def({
    schema: bool,
    default: false,
    isPublic: true,
    tier: 'super',
    group: 'maintenance',
    label: 'Maintenance mode',
    description: 'Viewers see a maintenance page, admins can still sign in',
  }),
  ...MONETIZATION_DEFS,
  ...DISCOVERY_DEFS,
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_DEFS)[K]['schema']>;
export type ResolvedSettings = { [K in SettingKey]: SettingValue<K> };

export const SETTING_KEYS = Object.keys(SETTING_DEFS) as SettingKey[];
export const PUBLIC_SETTING_KEYS = SETTING_KEYS.filter((key) => SETTING_DEFS[key].isPublic);

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTING_DEFS, key);
}

export function defaultSettings(): ResolvedSettings {
  return Object.fromEntries(
    SETTING_KEYS.map((key) => [key, structuredClone(SETTING_DEFS[key].default)]),
  ) as ResolvedSettings;
}

export type PublicSettings = Partial<{ [K in SettingKey]: SettingValue<K> }>;
