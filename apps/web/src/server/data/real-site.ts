import 'server-only';
import { PAGE_PLACEHOLDERS, PAGE_SLUGS, PAGE_TITLES, type SettingsService } from '@ad/theme';
import { FOOTER_LINKS, HELP_ARTICLES, VALUE_LINES } from '../../lib/site/defaults';
import { legalFromHtml } from '../../lib/site/legal-html';
import type { LegalPage, SiteContent, SiteRepository } from '../../lib/data/types';

type SettingsReader = Pick<SettingsService, 'getAll' | 'getPublishedPage'>;

/**
 * Site content from the settings table (M29-S01). Name, tagline, support email, the sign up mode and the
 * maintenance switches follow settings, with the settings service's own cache and its fall back to compiled
 * defaults if the read fails (M29-S02). Terms, privacy, about and help are the pages the admin editor publishes
 * (M26-S02). Migration 0022 seeds each with marked placeholder text, so a fresh site shows the Draft banner and
 * the launch checklist asks for the real text. No fixture text is served here.
 */
export class RealSite implements SiteRepository {
  constructor(
    private readonly settings: SettingsReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async content(): Promise<SiteContent> {
    const all = await this.settings.getAll();
    const banner = all['maintenance.banner'];
    const time = this.now().getTime();
    const started = !banner.startsAt || Date.parse(banner.startsAt) <= time;
    const notEnded = !banner.endsAt || Date.parse(banner.endsAt) > time;
    const showBanner = banner.enabled && banner.message !== '' && started && notEnded;
    return {
      valueLines: [...VALUE_LINES],
      footerLinks: FOOTER_LINKS.map((link) => ({ ...link })),
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

  /**
   * The page the admin published. If the database has none (the seed has not run, or the read failed), the
   * editor's own placeholder text stands in and the page counts as a draft (M26-S01 AC3).
   */
  async legal(slug: string): Promise<LegalPage | null> {
    if (!(PAGE_SLUGS as readonly string[]).includes(slug)) return null;
    const pageSlug = slug as (typeof PAGE_SLUGS)[number];
    const page = await this.settings.getPublishedPage(pageSlug);
    return legalFromHtml({
      slug: pageSlug,
      title: page?.title ?? PAGE_TITLES[pageSlug],
      html: page?.html ?? PAGE_PLACEHOLDERS[pageSlug],
      updatedAt: page?.updatedAt ?? this.now().toISOString(),
    });
  }

  /** The common questions shown under the help page text the admin edits. */
  async helpArticles() {
    return HELP_ARTICLES.map((article) => ({ ...article }));
  }
}
