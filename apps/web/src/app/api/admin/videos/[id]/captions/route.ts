import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

export const GET = videoRoute('/api/admin/videos/[id]/captions', (api, req, p) =>
  api.admin.captions.list(req, one(p, 'id')),
);
