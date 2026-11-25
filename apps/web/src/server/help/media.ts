import { existsSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };
/** One path segment: letters, digits, dot, dash, underscore. No slash, no percent escapes, no leading dot. */
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

/** The file for /admin/help/media/img/<id>/<name>, only inside content/help/media and only a picture type. */
export function resolveHelpImage(
  contentDir: string,
  segments: readonly string[],
): { file: string; contentType: string } | null {
  if (segments.length === 0 || segments.length > 3) return null;
  if (!segments.every((s) => SEGMENT.test(s))) return null;
  const ext = (segments[segments.length - 1] as string).split('.').pop()?.toLowerCase() ?? '';
  const contentType = TYPES[ext];
  if (!contentType) return null;
  const root = resolve(contentDir, 'media');
  const file = resolve(join(root, ...segments));
  if (!file.startsWith(root + sep)) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return { file, contentType };
}
