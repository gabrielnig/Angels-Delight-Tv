import { shareText } from '../../lib/site/seo-settings';
import { canonicalShareUrl } from './share-targets';
import type { ShareTargetId } from './share-targets';

export interface ShareConfig {
  channels: ShareTargetId[];
  text: string;
  /** Absolute canonical address, or its path when no https origin is configured. */
  url: string;
  thumbnail?: string;
}

interface SeoForShare {
  shareChannels: string[];
  shareTemplate: string;
  platformName: string;
}

/** Everything the Share control needs from the server, with the link built from the slug alone (D-391). */
export function buildShareConfig(input: {
  seo: SeoForShare;
  title: string;
  kind: 'video' | 'series';
  slug: string;
  origin: string | undefined;
  thumbnail?: string;
}): ShareConfig {
  let url: string;
  try {
    if (!input.origin) throw new Error('no origin');
    url = canonicalShareUrl({ origin: input.origin, kind: input.kind, slug: input.slug });
  } catch {
    url = canonicalShareUrl({ origin: 'http://localhost', kind: input.kind, slug: input.slug }).replace(
      'http://localhost',
      '',
    );
  }
  return {
    channels: input.seo.shareChannels as ShareTargetId[],
    text: shareText(input.seo.shareTemplate, { title: input.title, siteName: input.seo.platformName }),
    url,
    ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
  };
}
