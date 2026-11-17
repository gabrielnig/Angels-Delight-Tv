import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

export const POST = videoRoute('/api/play/[id]/session', (api, req, p) =>
  api.play.session(req, one(p, 'id')),
);
