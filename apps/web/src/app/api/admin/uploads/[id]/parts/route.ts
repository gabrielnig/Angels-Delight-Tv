import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

export const POST = videoRoute('/api/admin/uploads/[id]/parts', (api, req, p) =>
  api.upload.parts(req, one(p, 'id')),
);
