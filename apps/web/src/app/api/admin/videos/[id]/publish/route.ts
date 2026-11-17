import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

export const POST = videoRoute('/api/admin/videos/[id]/publish', (api, req, p) =>
  api.admin.publish(req, one(p, 'id')),
);
