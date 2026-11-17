import 'server-only';
import type { AdminContext } from '@ad/catalog';
import type { Database } from '@ad/db';
import { schema } from '@ad/db';
import { DrizzleJobMirror, JobProducer, createProducerBoss, bossAdapter } from '@ad/queue';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import type { Actor } from '@ad/shared';
import { CaptionService } from '@ad/video';
import { recordAudit } from '@ad/audit';
import { createStorage, storageConfigFromEnv } from '@ad/storage';
import { getServices } from '@/lib/runtime/services';

/** What the real admin services need from the process. Tests install a fake with `setAdminRuntime`. */
export interface AdminRuntime {
  db(): Database;
  /** Catalog context with the current caption approval setting (D-005). */
  ctx(): Promise<AdminContext>;
  enqueue: JobProducer['enqueue'];
  /** Review and approval of caption revisions (lane D). */
  captions(): Promise<CaptionService>;
  /** Display names for staff accounts, by account id. Unknown ids are left out. */
  names(actor: Actor, ids: readonly string[]): Promise<Map<string, string>>;
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
    captions: async () => {
      throw new Error('This test did not provide a caption service');
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

export function titleCaseFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Staff';
  const words = local.split(/[._-]+/).filter(Boolean);
  return (words.length ? words : ['Staff'])
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function build(): AdminRuntime {
  let producer: Promise<JobProducer> | undefined;
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
      return { db, requireApprovedCaptions: await readRequireApprovedCaptions(db) };
    },
    enqueue: (async (...args: Parameters<JobProducer['enqueue']>) =>
      (await getProducer()).enqueue(...args)) as JobProducer['enqueue'],
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
    async names(actor, ids) {
      const out = new Map<string, string>();
      const unique = [...new Set(ids)];
      if (!unique.length) return out;
      const { authRuntime } = await import('@/server/auth/runtime');
      const result = await getServices().db.execute<{ id: string; email_enc: Buffer }>(
        sql`SELECT id, email_enc FROM staff_directory(${actor.accountId}::uuid, ${sql`ARRAY[${sql.join(
          unique.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}]`})`,
      );
      for (const row of result.rows) {
        try {
          const email = await authRuntime().keys.open(
            row.id,
            'email',
            new Uint8Array(row.email_enc),
          );
          out.set(row.id, titleCaseFromEmail(email));
        } catch {
          // A name that cannot be opened is shown as unknown rather than failing the page.
        }
      }
      return out;
    },
  };
}
