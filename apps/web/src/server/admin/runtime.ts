import 'server-only';
import type { AdminContext } from '@ad/catalog';
import type { Database } from '@ad/db';
import { schema } from '@ad/db';
import { DrizzleJobMirror, JobProducer, createProducerBoss, bossAdapter } from '@ad/queue';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import type { Actor } from '@ad/shared';
import { CaptionService, FailedEncodeService, translationCapability } from '@ad/video';
import { readSetting } from '@ad/theme/settings';
import { recordAudit } from '@ad/audit';
import { createStorage, storageConfigFromEnv, type StorageAdapter } from '@ad/storage';
import type { KeyService, SessionService, StaffService, ViewerMfaService } from '@ad/auth';
import type { RequestMeta } from '@ad/auth';
import { getServices } from '@/lib/runtime/services';
import { authRuntime } from '@/server/auth/runtime';

/** What the real admin services need from the process. Tests install a fake with `setAdminRuntime`. */
export interface AdminRuntime {
  db(): Database;
  /** Catalog context with the current caption approval setting (D-005). */
  ctx(): Promise<AdminContext>;
  enqueue: JobProducer['enqueue'];
  /** Queues the worker job that builds one export file (M19-S05, M20-S03). Null when it was already queued. */
  enqueueExport(exportId: string): Promise<string | null>;
  /** The private bucket for uploaded sources (posters, later other images). */
  originals(): StorageAdapter;
  /** Failed encode inspection and cleanup (M14-S06). */
  failedEncodes(): FailedEncodeService;
  /** Public base url of the media bucket, for picker previews. */
  mediaOrigin(): string;
  /** Review and approval of caption revisions (lane D). */
  captions(): Promise<CaptionService>;
  /** Display names for staff accounts, by account id. Unknown ids are left out. */
  names(actor: Actor, ids: readonly string[]): Promise<Map<string, string>>;
  /** The auth services behind people, roles and my account (lane B). */
  auth(): {
    staff: StaffService;
    sessions: SessionService;
    keys: KeyService;
    viewerMfa?: ViewerMfaService;
  };
  /** The field encryption key, for the sealed copy of a staff address that the worker mails (D-129). */
  fieldKek(): Uint8Array;
  /** Puts a new session cookie on the response, after a password change rotates the session. */
  setSession(token: string): Promise<void>;
  /** The current time. Tests install a fixed clock. */
  now(): Date;
  /** Who is asking, for rate limits and audit. */
  meta(): Promise<RequestMeta>;
}

const slot = Symbol.for('ad.admin.runtime');
type Holder = { [slot]?: AdminRuntime };

/** Tests install a runtime built from just the parts they use. Anything else fails loudly if it is touched. */
export function setAdminRuntime(
  runtime: (Partial<AdminRuntime> & Pick<AdminRuntime, 'db'>) | null,
): void {
  const holder = globalThis as Holder;
  if (!runtime) {
    delete holder[slot];
    return;
  }
  holder[slot] = {
    ctx: async () => ({ db: runtime.db() }),
    enqueue: (async () => ({ jobId: 'test-job', deduped: false })) as AdminRuntime['enqueue'],
    names: async () => new Map(),
    enqueueExport: async () => 'test-boss-job',
    originals: () => {
      throw new Error('This test did not provide originals storage');
    },
    failedEncodes: () => {
      throw new Error('This test did not provide the failed encode service');
    },
    mediaOrigin: () => 'https://media.test',
    captions: async () => {
      throw new Error('This test did not provide a caption service');
    },
    auth: () => {
      throw new Error('This test did not provide the auth services');
    },
    fieldKek: () => {
      throw new Error('This test did not provide the field key');
    },
    now: () => new Date(),
    setSession: async () => {
      throw new Error('This test did not provide a session cookie writer');
    },
    meta: async () => {
      throw new Error('This test did not provide request details');
    },
    ...runtime,
  };
}

export function adminRuntime(): AdminRuntime {
  const holder = globalThis as Holder;
  return (holder[slot] ??= build());
}

export async function readRequireApprovedCaptions(db: Database): Promise<boolean> {
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, 'features.require_approved_captions'));
  return row ? row.value !== false : true;
}

export async function readCaptionsDefaultAvailable(db: Database): Promise<boolean> {
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, 'features.captions_default_available'));
  return row ? row.value !== false : true;
}

export function titleCaseFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Staff';
  const words = local.split(/[._-]+/).filter(Boolean);
  return (words.length ? words : ['Staff'])
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Display names for staff accounts through the `staff_directory` function. Unknown or unreadable ids are left out. */
export async function staffNames(
  db: Database,
  keys: KeyService,
  actor: Actor,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids)];
  if (!unique.length) return out;
  const result = await db.execute<{
    id: string;
    email_enc: Buffer;
    display_name_enc: Buffer | null;
  }>(
    sql`SELECT id, email_enc, display_name_enc FROM staff_directory(${actor.accountId}::uuid, ${sql`ARRAY[${sql.join(
      unique.map((id) => sql`${id}::uuid`),
      sql`, `,
    )}]`})`,
  );
  for (const row of result.rows) {
    try {
      if (row.display_name_enc) {
        out.set(
          row.id,
          await keys.open(row.id, 'display_name', new Uint8Array(row.display_name_enc)),
        );
      } else {
        out.set(
          row.id,
          titleCaseFromEmail(await keys.open(row.id, 'email', new Uint8Array(row.email_enc))),
        );
      }
    } catch {
      // A name that cannot be opened is shown as unknown rather than failing the page.
    }
  }
  return out;
}

function build(): AdminRuntime {
  let producer: Promise<JobProducer> | undefined;
  let originalsStorage: StorageAdapter | undefined;
  let failedService: FailedEncodeService | undefined;
  const getProducer = () =>
    (producer ??= createProducerBoss({
      connectionString: getServices().env.DATABASE_URL,
      onError: (error) =>
        getServices().logger.error('queue producer error', { error: String(error) }),
    }).then(
      (boss) =>
        new JobProducer({
          boss: bossAdapter(boss),
          mirror: new DrizzleJobMirror(getServices().db),
        }),
    ));
  return {
    db: () => getServices().db,
    async ctx() {
      const db = getServices().db;
      return {
        db,
        requireApprovedCaptions: await readRequireApprovedCaptions(db),
        captionsDefaultAvailable: await readCaptionsDefaultAvailable(db),
      };
    },
    enqueue: (async (...args: Parameters<JobProducer['enqueue']>) =>
      (await getProducer()).enqueue(...args)) as JobProducer['enqueue'],
    enqueueExport: async (exportId) =>
      (await getProducer()).enqueueUntracked('exports.generate', { exportId }),
    originals() {
      const { env } = getServices();
      return (originalsStorage ??= createStorage(
        storageConfigFromEnv(env, env.BUCKET_ORIGINALS, env.MEDIA_URL_SECRET),
      ));
    },
    failedEncodes() {
      const services = getServices();
      return (failedService ??= new FailedEncodeService({
        db: services.db,
        originals: adminRuntime().originals(),
        media: services.mediaStorage,
        logger: services.logger,
      }));
    },
    mediaOrigin: () => getServices().env.MEDIA_ORIGIN,
    captions: async () => {
      const services = getServices();
      const { env, db } = services;
      const originals = createStorage(
        storageConfigFromEnv(env, env.BUCKET_ORIGINALS, env.MEDIA_URL_SECRET),
      );
      return new CaptionService({
        db,
        originals,
        media: services.mediaStorage,
        producer: { enqueue: (...args) => adminRuntime().enqueue(...args) },
        translation: translationCapability(env.TRANSLATE_PROVIDER),
        captionLanguages: async () => (await readSetting(db, 'content.languages')) as string[],
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
    },
    auth: () => {
      const { staff, sessions, keys, viewerMfa } = authRuntime();
      return { staff, sessions, keys, viewerMfa };
    },
    fieldKek: () => getServices().env.FIELD_KEK,
    now: () => new Date(),
    setSession: async (token) =>
      (await import('@/server/auth/session')).setSessionCookie(token, 'staff'),
    meta: async () => (await import('@/server/auth/session')).requestMeta(),
    names: (actor, ids) => staffNames(getServices().db, authRuntime().keys, actor, ids),
  };
}
