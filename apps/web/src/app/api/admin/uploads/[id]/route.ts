import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

export const GET = videoRoute('/api/admin/uploads/[id]', (api, req, p) =>
  api.upload.describe(req, one(p, 'id')),
);
export const DELETE = videoRoute('/api/admin/uploads/[id]', (api, req, p) =>
  api.upload.abort(req, one(p, 'id')),
);
