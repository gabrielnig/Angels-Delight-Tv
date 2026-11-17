import 'server-only';
import type { AdminContext, AdminVideo } from '@ad/catalog';
import { Forbidden, NotFound, ValidationFailed, type Actor } from '@ad/shared';
import { can } from '@/lib/admin/can';
import type { AdminAction } from '@/lib/admin/can';
import { adminRuntime } from '@/server/admin/runtime';
import type { AdminActor, VideoRecord } from '../types';

export const catalogActor = (actor: AdminActor): Actor => ({
  accountId: actor.accountId,
  role: actor.role,
});

export function need(actor: AdminActor, action: AdminAction): void {
  if (!can(actor.role, action)) throw new Forbidden();
}

export const context = (): Promise<AdminContext> => adminRuntime().ctx();

export async function toRecords(actor: AdminActor, videos: AdminVideo[]): Promise<VideoRecord[]> {
  const names = await adminRuntime().names(
    catalogActor(actor),
    videos.map((v) => v.createdBy).filter((id): id is string => Boolean(id)),
  );
  return videos.map(({ createdBy, ...rest }) => ({
    ...rest,
    uploadedBy: (createdBy && names.get(createdBy)) || 'Unknown',
  }));
}

export async function toRecord(actor: AdminActor, video: AdminVideo): Promise<VideoRecord> {
  return (await toRecords(actor, [video]))[0]!;
}

/** Commands answer with a result, but the catalog throws for missing or forbidden things. Keep the screens' contract. */
export async function asResult<T extends { ok: boolean }>(
  work: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof NotFound) return { ok: false, error: error.message };
    if (error instanceof Forbidden)
      return { ok: false, error: 'You do not have permission for this.' };
    if (error instanceof ValidationFailed) {
      const first = Object.values(error.fields)[0]?.[0];
      return { ok: false, error: first ?? 'Check the details and try again.' };
    }
    throw error;
  }
}
