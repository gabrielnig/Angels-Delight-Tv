import { z } from 'zod';

/**
 * Settings for module M45 (discovery, SEO and the storage notice). Everything a client can word or choose stays
 * here and nothing is hardcoded elsewhere (R02, R26). All text refuses dashes, emoji and markup.
 */

const FORBIDDEN_TEXT = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}<>]|\\p{Extended_Pictographic}`, 'u');

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !FORBIDDEN_TEXT.test(value), {
      message: 'Remove dashes, emoji and markup from this text',
    });

/** Channels the share menu can list. Copy link is always on and is not a channel here. */
export const SHARE_CHANNELS = ['whatsapp', 'facebook', 'x', 'telegram', 'email', 'sms'] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

const shareTemplate = z
  .string()
  .trim()
  .min(1, 'Enter the share text')
  .max(120)
  .refine((value) => !FORBIDDEN_TEXT.test(value), {
    message: 'Remove dashes, emoji and markup from this text',
  })
  .refine(
    (value) =>
      [...value.matchAll(/\{([^}]*)\}/g)].every((m) => m[1] === 'title' || m[1] === 'siteName'),
    { message: 'Only {title} and {siteName} can be used' },
  );

const imageLink = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => {
      if (value === '') return true;
      if (value.startsWith('/') && !value.startsWith('//')) return true;
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Use a full https:// link, or a path that starts with /' },
  );

interface DiscoveryDef<S extends z.ZodType> {
  schema: S;
  default: z.infer<S>;
  isPublic: boolean;
  tier: 'admin' | 'super';
  group: 'discovery';
  label: string;
  description: string;
}

function def<S extends z.ZodType>(
  value: Omit<DiscoveryDef<S>, 'group' | 'tier' | 'isPublic'> & { isPublic?: boolean },
): DiscoveryDef<S> {
  return { tier: 'admin', isPublic: true, ...value, group: 'discovery' };
}

export const DISCOVERY_DEFS = {
  'seo.site_description': def({
    schema: text(160),
    default: '',
    label: 'Site description',
    description:
      'One or two sentences shown under the site name in search results and link previews',
  }),
  'seo.default_social_image_url': def({
    schema: imageLink,
    default: '',
    label: 'Social image link',
    description:
      'The picture a shared link shows when a title has no poster. 1200 by 630 works best',
  }),
  'seo.share_text_template': def({
    schema: shareTemplate,
    default: '{title} on {siteName}',
    label: 'Share text',
    description: 'The words that go with a shared link. Use {title} and {siteName}',
  }),
  'seo.indexing': def({
    schema: z.boolean(),
    default: true,
    isPublic: false,
    label: 'Let search engines list the site',
    description: 'Turn off on a test site so nothing is listed',
  }),
  'seo.twitter_handle': def({
    schema: z
      .string()
      .trim()
      .max(16)
      .refine((value) => /^@?[A-Za-z0-9_]{0,15}$/.test(value), {
        message: 'Use letters, numbers and underscores only, up to 15 characters',
      }),
    default: '',
    label: 'X handle',
    description: 'The site account on X, for example learntv. Leave empty if there is none',
  }),
  'seo.share_title_overlay': def({
    schema: z.boolean(),
    default: true,
    label: 'Show the title on share pictures',
    description: 'Turn off when your posters already carry the title as text',
  }),
  'seo.share_play_badge': def({
    schema: z.boolean(),
    default: true,
    label: 'Show a play badge on video share pictures',
    description: 'A small play button on the picture a shared video link shows',
  }),
  'seo.share_channels': def({
    schema: z
      .array(z.enum(SHARE_CHANNELS))
      .max(SHARE_CHANNELS.length)
      .refine((list) => new Set(list).size === list.length, { message: 'List each channel once' }),
    default: ['whatsapp', 'facebook', 'x', 'telegram', 'email', 'sms'] as ShareChannel[],
    label: 'Share options',
    description: 'Which options the Share menu lists. Copy link is always on and the device share menu shows when the device has one',
  }),
  'consent.notice_enabled': def({
    schema: z.boolean(),
    default: true,
    label: 'Storage notice',
    description: 'A short notice about what the site keeps on a visitor device',
  }),
  'consent.notice_text': def({
    schema: text(300),
    default:
      'This site keeps a few small things on your device so it can work and remember your choices. It does not track you for advertising.',
    label: 'Storage notice text',
    description: 'Plain words, up to 300 characters',
  }),
  'consent.notice_version': def({
    schema: z.number().int().min(1).max(9999),
    default: 1,
    label: 'Storage notice version',
    description: 'Raise it to show the notice again to everyone who dismissed it',
  }),
} as const;

export const DISCOVERY_KEYS = Object.keys(DISCOVERY_DEFS) as (keyof typeof DISCOVERY_DEFS)[];
