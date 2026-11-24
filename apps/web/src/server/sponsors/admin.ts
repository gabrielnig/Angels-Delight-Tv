import 'server-only';
import { createHash } from 'node:crypto';
import { decryptAesGcm, encryptAesGcm, uuidv7, type Actor } from '@ad/shared';
import { schema, withAccount } from '@ad/db';
import { SponsorAdminService } from '@ad/sponsors';
import { themeRuntime } from '@/lib/data/admin/theme-runtime';
import { checkSponsorImage, type SponsorImageKind } from '@/lib/admin/sponsor-image';
import type { AdminActor } from '@/lib/data/admin/types';
import { adminRuntime } from '../admin/runtime';
import { getServices } from '@/lib/runtime/services';
import { createPgSponsorStore } from './pg-store';

const AAD = new TextEncoder().encode('sponsor_private');

function ownHosts(): string[] {
  const host = new URL(getServices().env.APP_ORIGIN).hostname.toLowerCase();
  return host.startsWith('www.') ? [host, host.slice(4)] : [host, `www.${host}`];
}

/** The sponsors admin service for one staff member. Every database call runs as that person (row level security). */
export function sponsorAdmin(actor: AdminActor): SponsorAdminService {
  const rt = adminRuntime();
  const who: Actor = { accountId: actor.accountId, role: actor.role };
  const kek = rt.fieldKek();
  return new SponsorAdminService({
    store: createPgSponsorStore(rt.db(), who),
    settings: {
      update: async (a, changes) => (await themeRuntime()).settings.update(a, changes),
    },
    reauthenticate: async (a, password) => {
      try {
        if (!actor.sessionId) return { ok: false, error: 'Sign in again to continue' };
        await rt
          .auth()
          .staff.reauthenticate(
            { accountId: a.accountId, role: a.role as 'admin', sessionId: actor.sessionId },
            password,
            await rt.meta(),
          );
        return { ok: true };
      } catch {
        return { ok: false, error: 'Password is not right' };
      }
    },
    ownHosts: ownHosts(),
    seal: async (plain) =>
      Buffer.from(encryptAesGcm(kek, new TextEncoder().encode(plain), AAD)).toString('base64'),
    unseal: async (sealed) =>
      new TextDecoder().decode(decryptAesGcm(kek, new Uint8Array(Buffer.from(sealed, 'base64')), AAD)),
  });
}

export type UploadResult = { ok: true; assetId: string } | { ok: false; error: string };

/** Stores a sponsor picture and queues `image.process`. The picture is checked on the server first. */
export async function uploadSponsorImage(
  actor: AdminActor,
  bytes: Uint8Array,
  kind: SponsorImageKind,
): Promise<UploadResult> {
  if (actor.role === 'viewer') return { ok: false, error: 'Only staff can upload pictures.' };
  const checked = await checkSponsorImage(bytes, kind);
  if (!checked.ok) return checked;
  const rt = adminRuntime();
  const assetId = uuidv7();
  const rawKey = `uploads/sponsors/${assetId}`;
  await rt.originals().put(rawKey, bytes, { contentType: checked.mime });
  await withAccount(rt.db(), { accountId: actor.accountId, role: actor.role }, (tx) =>
    tx.insert(schema.assets).values({
      id: assetId,
      purpose: 'sponsor',
      status: 'processing',
      rawKey,
      mime: checked.mime,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest(),
      createdBy: actor.accountId,
    }),
  );
  await rt.enqueue('image.process', { assetId });
  return { ok: true, assetId };
}
