import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The home screen icons the launch applier writes (`pnpm launch:apply`). Only these names are ever served. */
export const BRAND_ICON_FILES = [
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
] as const;

export interface BrandIconSources {
  /** `PWA_ICONS_DIR`: a mounted folder holding the client's icons. Optional. */
  brandDir?: string;
  /** The icons bundled in the image, used until the client's exist. */
  fallbackDir: string;
}

export async function readBrandIcon(
  file: string,
  sources: BrandIconSources,
): Promise<Buffer | null> {
  if (!(BRAND_ICON_FILES as readonly string[]).includes(file)) return null;
  for (const dir of [sources.brandDir, sources.fallbackDir]) {
    if (!dir) continue;
    try {
      return await readFile(join(dir, file));
    } catch {
      // try the next folder
    }
  }
  return null;
}
