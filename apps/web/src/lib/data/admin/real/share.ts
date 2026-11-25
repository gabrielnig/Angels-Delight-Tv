import 'server-only';
import { getShareText, setShareText, type ShareText } from '@ad/catalog';
import { ValidationFailed } from '@ad/shared';
import type { AdminActor } from '../types';
import { catalogActor, context, need } from './shared';

export type ShareKind = 'video' | 'series';

const ACTION = { video: 'video.edit', series: 'series.manage' } as const;

/** Share card words of a title: read and save, with the same permission as editing the title. */
export const shareAdmin = {
  async get(actor: AdminActor, kind: ShareKind, id: string): Promise<ShareText> {
    need(actor, ACTION[kind]);
    return getShareText(await context(), catalogActor(actor), kind, id);
  },
  async save(
    actor: AdminActor,
    kind: ShareKind,
    id: string,
    input: { title: string; description: string },
  ): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
    need(actor, ACTION[kind]);
    try {
      await setShareText(await context(), catalogActor(actor), kind, id, input);
      return { ok: true };
    } catch (error) {
      if (error instanceof ValidationFailed) {
        return {
          ok: false,
          errors: Object.fromEntries(Object.entries(error.fields).map(([k, v]) => [k, v[0] ?? ''])),
        };
      }
      throw error;
    }
  },
};
