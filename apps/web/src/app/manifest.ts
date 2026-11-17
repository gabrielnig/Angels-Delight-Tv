import type { MetadataRoute } from 'next';
import { getPwaSettings } from '../lib/data/pwa-settings';
import { buildManifest } from '../lib/pwa/manifest';

export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return buildManifest(await getPwaSettings());
}
