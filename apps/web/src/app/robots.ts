import type { MetadataRoute } from 'next';
import { buildRobots } from '../lib/seo/robots-rules';
import { getSeoSettings } from '../server/seo/seo-settings';

export const dynamic = 'force-dynamic';

/** Crawler rules (M45-S01). The Discovery tab can switch indexing off, and staging is always closed. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { indexing } = await getSeoSettings();
  return buildRobots({
    origin: process.env.APP_ORIGIN,
    indexing,
    production: process.env.NODE_ENV === 'production',
  });
}
