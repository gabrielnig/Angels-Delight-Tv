import 'server-only';
import type { SettingsService } from '@ad/theme';
import { legalFromHtml } from '../../lib/site/legal-html';
import type { LegalPage, SiteContent, SiteRepository } from '../../lib/data/types';

type SettingsReader = Pick<SettingsService, 'getAll' | 'getPublishedPage'>;

const PUBLISHED_SLUGS = ['terms', 'privacy', 'about'] as const;

/**
 * Site content from the settings table (M29-S01). Name, tagline, support email, the sign up mode and the
 * maintenance switches follow settings, with the settings service's own cache and its fall back to compiled
 * defaults if the read fails (M29-S02). Footer links, value lines, legal pages and help come from the fallback.
 */
export class RealSite implements SiteRepository {
  constructor(
    private readonly settings: SettingsReader,
    private readonly fallback: SiteRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async content(): Promise<SiteContent> {
    const [all, base] = await Promise.all([this.settings.getAll(), this.fallback.content()]);
    const banner = all['maintenance.banner'];
    const time = this.now().getTime();
    const started = !banner.startsAt || Date.parse(banner.startsAt) <= time;
    const notEnded = !banner.endsAt || Date.parse(banner.endsAt) > time;
    const showBanner = banner.enabled && banner.message !== '' && started && notEnded;
    return {
      ...base,
      platformName: all['platform.name'],
      tagline: all['platform.tagline'],
      supportEmail: all['platform.support_email'],
      signUpOpen: all['features.signups_open'],
      maintenance: {
        active: all['maintenance.mode'],
        ...(showBanner ? { banner: banner.message } : {}),
      },
    };
  }

  /** The page the admin published, else the marked draft placeholder (M26-S01 AC3, M26-S02). */
  async legal(slug: string): Promise<LegalPage | null> {
    if (!(PUBLISHED_SLUGS as readonly string[]).includes(slug)) return this.fallback.legal(slug);
    const page = await this.settings.getPublishedPage(slug as (typeof PUBLISHED_SLUGS)[number]);
    if (!page) return this.fallback.legal(slug);
    return legalFromHtml({
      slug: slug as LegalPage['slug'],
      title: page.title,
      html: page.html,
      updatedAt: page.updatedAt,
    });
  }

  helpArticles() {
    return this.fallback.helpArticles();
  }
}
