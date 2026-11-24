import { ogHandler } from '../../../../server/seo/og-data';

export const dynamic = 'force-dynamic';

/** `/og/title/<slug>` and `/og/series/<slug>`: the 1200 by 630 picture link previews show (M45-S03). */
export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string; slug: string }> },
) {
  const { kind, slug } = await context.params;
  if (kind !== 'title' && kind !== 'series') return new Response('Not found', { status: 404 });
  return ogHandler(request, kind === 'title' ? 'video' : 'series', slug);
}
