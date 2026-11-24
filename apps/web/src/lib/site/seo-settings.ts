import type { ResolvedSettings } from '@ad/theme/settings';

type ShareChannel = ResolvedSettings['seo.share_channels'][number];

export const FALLBACK_DESCRIPTION = 'Free learning videos for everyone.';
export const PLACEHOLDER_SOCIAL_IMAGE = '/brand-icons/placeholder-og.png';

export interface SeoSettings {
  description: string;
  socialImageUrl: string;
  shareTemplate: string;
  shareChannels: ShareChannel[];
  indexing: boolean;
  platformName: string;
}

/** Description: the Discovery tab text, then the tagline, then a neutral line. Image: the setting, then the placeholder. */
export function resolveSeoSettings(values: ResolvedSettings): SeoSettings {
  return {
    description:
      values['seo.site_description'].trim() ||
      values['platform.tagline'].trim() ||
      FALLBACK_DESCRIPTION,
    socialImageUrl: values['seo.default_social_image_url'].trim() || PLACEHOLDER_SOCIAL_IMAGE,
    shareTemplate: values['seo.share_text_template'],
    shareChannels: [...values['seo.share_channels']],
    indexing: values['seo.indexing'],
    platformName: values['platform.name'],
  };
}

export function shareText(template: string, input: { title: string; siteName: string }): string {
  return template.replaceAll('{title}', input.title).replaceAll('{siteName}', input.siteName);
}
