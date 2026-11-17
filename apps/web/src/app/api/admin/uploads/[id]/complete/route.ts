import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

export const POST = videoRoute('/api/admin/uploads/[id]/complete', (api, req, p) =>
  api.upload.complete(req, one(p, 'id')),
);
