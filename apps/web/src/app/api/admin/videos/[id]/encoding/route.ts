import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

export const GET = videoRoute('/api/admin/videos/[id]/encoding', (api, req, p) =>
  api.admin.encoding(req, one(p, 'id')),
);
