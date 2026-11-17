import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

export const POST = videoRoute('/api/admin/captions/[id]/approve', (api, req, p) =>
  api.admin.captions.approve(req, one(p, 'id')),
);
