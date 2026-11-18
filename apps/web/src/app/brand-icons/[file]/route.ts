import { join } from 'node:path';
import { readBrandIcon } from '../../../lib/pwa/brand-icons';

export const dynamic = 'force-dynamic';

/** Serves the client's home screen icons from `PWA_ICONS_DIR`, or the bundled ones. No rebuild needed to rebrand. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await context.params;
  const icon = await readBrandIcon(file, {
    brandDir: process.env.PWA_ICONS_DIR,
    fallbackDir: join(process.cwd(), 'public', 'icons'),
  });
  if (!icon) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(icon), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  });
}
