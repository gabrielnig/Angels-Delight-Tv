import { ARTICLE_ID } from '@ad/help';
import type { VideoSource } from './video';

const RELEASE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/;

/**
 * The prebuilt PDF for one guide: `<id>.pdf` under `help/<release>/pdf/` in private storage, written at release.
 * The `sample` release has none, and nothing but a guide id with .pdf resolves, so a path never leaves its folder.
 */
export function resolvePdfSource(release: string, name: string): VideoSource | null {
  const m = /^([A-Z]\d{2})\.pdf$/.exec(name);
  if (!m || !ARTICLE_ID.test(m[1] as string)) return null;
  if (!RELEASE.test(release) || release === 'sample') return null;
  return { kind: 'storage', key: `help/${release}/pdf/${name}` };
}
