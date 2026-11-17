import 'server-only';
import { can } from '@/lib/admin/can';
import { buildDashboard } from './dashboard';
import type { DashboardData } from './dashboard';
import { getStore } from './store';
import type { AdminActor } from './types';
import { adminStatusOf } from './video-rules';

/**
 * Typed data access for the admin UI. These interfaces are the seam: fixtures answer today, the
 * real services from the content, pipeline and auth lanes replace the bodies later. Every call
 * takes the actor and re-checks permission (never trust the page alone).
 */
export interface DashboardService {
  get(actor: AdminActor, options?: { failTiles?: string[] }): Promise<DashboardData>;
  navCounts(actor: AdminActor): Promise<{ encoding: number; captions: number }>;
}

export const dashboardService: DashboardService = {
  async get(actor, options) {
    if (!can(actor.role, 'admin.access')) throw new Error('forbidden');
    return buildDashboard(actor, getStore(), options);
  },
  async navCounts(actor) {
    if (!can(actor.role, 'admin.access')) return { encoding: 0, captions: 0 };
    const live = getStore().videos.filter((v) => v.deletedAt === null);
    return {
      encoding: live.filter((v) => adminStatusOf(v) === 'processing').length,
      captions: live.filter((v) => v.captionState === 'needs_review').length,
    };
  },
};

/** 'fixture' until the upload API is wired. The client picks its transport from this. */
export function uploadTransportMode(): 'fixture' | 'http' {
  return process.env.ADMIN_UPLOADS === 'http' ? 'http' : 'fixture';
}
