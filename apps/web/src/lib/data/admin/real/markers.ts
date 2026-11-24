import 'server-only';
import { recordAudit } from '@ad/audit';
import { MarkerService } from '@ad/video';
import { adminRuntime } from '@/server/admin/runtime';
import type { MarkersAdminService } from '../markers';
import { catalogActor, need } from './shared';

function service(): MarkerService {
  const db = adminRuntime().db();
  return new MarkerService({
    db,
    clock: () => adminRuntime().now(),
    audit: {
      record: (event) =>
        recordAudit(db, {
          action: event.action,
          outcome: event.outcome,
          actorAccountId: event.actorAccountId,
          actorRole: event.actorRole,
          targetType: event.targetType,
          targetId: event.targetId,
          extra: event.metadata,
        }),
    },
  });
}

export const realMarkers: MarkersAdminService = {
  async get(actor, videoId) {
    need(actor, 'video.markers');
    return service().get(catalogActor(actor), videoId);
  },
  async siblings(actor, videoId) {
    need(actor, 'video.markers');
    return service().siblings(catalogActor(actor), videoId);
  },
  async save(actor, videoId, payload) {
    need(actor, 'video.markers');
    await service().replace(catalogActor(actor), videoId, payload);
  },
};
