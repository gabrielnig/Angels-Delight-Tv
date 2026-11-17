import { videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

export const POST = videoRoute('/api/admin/uploads', (api, req) => api.upload.create(req));
