import { schema, type Database } from '@ad/db';
import type { JobProducer } from '@ad/queue';
import {
  Conflict,
  Forbidden,
  NotFound,
  ValidationFailed,
  isUuid,
  mediaPrefix,
  uuidv7,
  type Actor,
  type Logger,
  isStaffRole,
  isAdminRole,
} from '@ad/shared';
import { createLogger } from '@ad/shared';
import { planParts, verifyCompletedParts, type PartInfo, type StorageAdapter } from '@ad/storage';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import {
  choosePartSize,
  slugFromTitle,
  titleFromFilename,
  validateUploadRequest,
  type UploadLimits,
  type UploadRequest,
} from './validation';

const { uploadSessions, videos, renditions, videoKeys } = schema;

type SessionRow = typeof uploadSessions.$inferSelect;

export class UploadIncomplete extends Conflict {
  constructor(readonly missing: number[]) {
    super(`Parts still missing: ${missing.join(', ')}`);
    this.name = 'UploadIncomplete';
  }
}

export interface UploadServiceDeps {
  db: Database;
  originals: StorageAdapter;
  media: StorageAdapter;
  producer: Pick<JobProducer, 'enqueue'>;
  limits: UploadLimits;
  clock?: () => Date;
  logger?: Logger;
  /** Hours a session may sit idle before cleanup aborts it (ARCHITECTURE section 7). */
  sessionTtlHours?: number;
  partUrlTtlSeconds?: number;
  maxPendingPerCreator?: number;
}

export interface UploadState {
  uploadId: string;
  videoId: string;
  partSize: number;
  totalParts: number;
  uploadedParts: number[];
  status: SessionRow['status'];
  filename: string;
  size: number;
}

export interface CreateResult extends UploadState {
  resumed: boolean;
  /** Set when a finished upload has the same name and size, so the screen can offer Upload anyway or Skip. */
  duplicateOf?: { videoId: string; title: string };
}

const OPEN: SessionRow['status'][] = ['initiated', 'uploading'];
const ACTIVE: SessionRow['status'][] = ['initiated', 'uploading', 'completing'];

function assertUploader(actor: Actor): void {
  if (!isStaffRole(actor.role)) throw new Forbidden('Only editors and admins can upload');
}

function isUniqueViolation(error: unknown): boolean {
  return (
    (error as { code?: string; cause?: { code?: string } })?.code === '23505' ||
    (error as { cause?: { code?: string } })?.cause?.code === '23505'
  );
}

export class UploadService {
  private readonly db: Database;
  private readonly originals: StorageAdapter;
  private readonly media: StorageAdapter;
  private readonly producer: Pick<JobProducer, 'enqueue'>;
  private readonly limits: UploadLimits;
  private readonly clock: () => Date;
  private readonly logger: Logger;
  private readonly ttlMs: number;
  private readonly partUrlTtl: number;
  private readonly maxPending: number;

  constructor(deps: UploadServiceDeps) {
    this.db = deps.db;
    this.originals = deps.originals;
    this.media = deps.media;
    this.producer = deps.producer;
    this.limits = deps.limits;
    this.clock = deps.clock ?? (() => new Date());
    this.logger = deps.logger ?? createLogger({ write: () => undefined });
    this.ttlMs = (deps.sessionTtlHours ?? 48) * 3600 * 1000;
    this.partUrlTtl = deps.partUrlTtlSeconds ?? 3600;
    this.maxPending = deps.maxPendingPerCreator ?? 20;
  }

  private expiry(): Date {
    return new Date(this.clock().getTime() + this.ttlMs);
  }

  private async load(actor: Actor, uploadId: string): Promise<SessionRow> {
    assertUploader(actor);
    if (!isUuid(uploadId)) throw new NotFound('Upload not found');
    const [session] = await this.db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, uploadId))
      .limit(1);
    if (!session || (!isAdminRole(actor.role) && session.createdBy !== actor.accountId)) {
      throw new NotFound('Upload not found');
    }
    return session;
  }

  private async partsOf(session: SessionRow): Promise<PartInfo[]> {
    try {
      return await this.originals.listParts(session.storageKey, session.s3UploadId);
    } catch (error) {
      if (error instanceof NotFound) return [];
      throw error;
    }
  }

  private stateOf(session: SessionRow, uploaded: number[]): UploadState {
    return {
      uploadId: session.id,
      videoId: session.videoId ?? '',
      partSize: session.partSizeBytes,
      totalParts: session.totalParts,
      uploadedParts: uploaded,
      status: session.status,
      filename: session.filename,
      size: session.sizeBytes,
    };
  }

  async create(
    actor: Actor,
    request: UploadRequest,
    options: { replaceVideoId?: string } = {},
  ): Promise<CreateResult> {
    assertUploader(actor);
    const valid = validateUploadRequest(request, this.limits);

    const [existing] = await this.db
      .select()
      .from(uploadSessions)
      .where(
        and(
          eq(uploadSessions.createdBy, actor.accountId),
          eq(uploadSessions.fingerprint, valid.fingerprint),
          inArray(uploadSessions.status, OPEN),
        ),
      )
      .limit(1);
    if (existing) {
      const parts = (await this.partsOf(existing))
        .map((part) => part.partNumber)
        .sort((a, b) => a - b);
      return { ...this.stateOf(existing, parts), resumed: true };
    }

    const [{ pending } = { pending: 0 }] = await this.db
      .select({ pending: sql<number>`count(*)::int` })
      .from(uploadSessions)
      .where(
        and(eq(uploadSessions.createdBy, actor.accountId), inArray(uploadSessions.status, ACTIVE)),
      );
    if (pending >= this.maxPending) {
      throw new Conflict('Too many unfinished uploads. Finish or cancel some first.');
    }

    let videoId = uuidv7();
    let replacing = false;
    if (options.replaceVideoId) {
      const [target] = await this.db
        .select()
        .from(videos)
        .where(eq(videos.id, options.replaceVideoId))
        .limit(1);
      if (!target || target.deletedAt) throw new NotFound('Video not found');
      if (target.publishState === 'published' || target.publishState === 'scheduled') {
        throw new Conflict('Unpublish this video before replacing its file.');
      }
      videoId = target.id;
      replacing = true;
    }

    const sessionId = uuidv7();
    const storageKey = `originals/${videoId}/${sessionId}`;
    const partSize = choosePartSize(valid.size, this.limits.partBytes);
    const plan = planParts(valid.size, partSize);
    const { uploadId: s3UploadId } = await this.originals.createMultipart(storageKey, {
      contentType: valid.mime,
    });

    try {
      await this.db.transaction(async (tx) => {
        if (!replacing) {
          const title = titleFromFilename(valid.filename);
          await tx.insert(videos).values({
            id: videoId,
            slug: slugFromTitle(title),
            title,
            mediaPrefix: mediaPrefix(),
            createdBy: actor.accountId,
          });
        }
        await tx.insert(uploadSessions).values({
          id: sessionId,
          kind: 'video',
          videoId,
          createdBy: actor.accountId,
          filename: valid.filename,
          declaredMime: valid.mime,
          sizeBytes: valid.size,
          partSizeBytes: partSize,
          totalParts: plan.totalParts,
          storageKey,
          s3UploadId,
          fingerprint: valid.fingerprint,
          expiresAt: this.expiry(),
        });
      });
    } catch (error) {
      await this.originals.abortMultipart(storageKey, s3UploadId).catch(() => undefined);
      if (isUniqueViolation(error)) {
        const [winner] = await this.db
          .select()
          .from(uploadSessions)
          .where(
            and(
              eq(uploadSessions.createdBy, actor.accountId),
              eq(uploadSessions.fingerprint, valid.fingerprint),
              inArray(uploadSessions.status, OPEN),
            ),
          )
          .limit(1);
        if (winner) return { ...this.stateOf(winner, []), resumed: true };
      }
      throw error;
    }

    const [created] = await this.db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, sessionId));
    const [duplicate] = await this.db
      .select({ videoId: uploadSessions.videoId, title: videos.title })
      .from(uploadSessions)
      .innerJoin(videos, eq(videos.id, uploadSessions.videoId))
      .where(
        and(
          eq(uploadSessions.filename, valid.filename),
          eq(uploadSessions.sizeBytes, valid.size),
          eq(uploadSessions.status, 'completed'),
          sql`${uploadSessions.videoId} <> ${videoId}`,
        ),
      )
      .limit(1);

    return {
      ...this.stateOf(created!, []),
      resumed: false,
      ...(duplicate?.videoId
        ? { duplicateOf: { videoId: duplicate.videoId, title: duplicate.title } }
        : {}),
    };
  }

  async describe(actor: Actor, uploadId: string): Promise<UploadState> {
    const session = await this.load(actor, uploadId);
    if (session.status === 'completed') {
      const all = Array.from({ length: session.totalParts }, (_, index) => index + 1);
      return this.stateOf(session, all);
    }
    const uploaded = (await this.partsOf(session))
      .map((part) => part.partNumber)
      .sort((a, b) => a - b);
    let current = session;
    if (session.status === 'initiated' && uploaded.length > 0) {
      await this.db
        .update(uploadSessions)
        .set({ status: 'uploading' })
        .where(eq(uploadSessions.id, session.id));
      current = { ...session, status: 'uploading' };
    }
    return this.stateOf(current, uploaded);
  }

  /** Each url is signed for the exact length that part carries (SECURITY section 8 step 2). */
  async presignParts(
    actor: Actor,
    uploadId: string,
    partNumbers: number[],
  ): Promise<Record<string, string>> {
    const session = await this.load(actor, uploadId);
    if (!OPEN.includes(session.status)) throw new Conflict('This upload is no longer open.');
    const plan = planParts(session.sizeBytes, session.partSizeBytes);
    const valid = partNumbers.every((n) => Number.isInteger(n) && n >= 1 && n <= plan.totalParts);
    if (!valid || partNumbers.length === 0 || partNumbers.length > 50) {
      throw new ValidationFailed({
        partNumbers: ['Ask for parts between 1 and the total, at most 50 at a time.'],
      });
    }
    const urls: Record<string, string> = {};
    for (const n of partNumbers) {
      const planned = plan.parts[n - 1]!;
      urls[String(n)] = await this.originals.presignPart(
        session.storageKey,
        session.s3UploadId,
        n,
        planned.sizeBytes,
        this.partUrlTtl,
      );
    }
    await this.db
      .update(uploadSessions)
      .set({ status: 'uploading', expiresAt: this.expiry() })
      .where(eq(uploadSessions.id, session.id));
    return urls;
  }

  async complete(
    actor: Actor,
    uploadId: string,
  ): Promise<{ uploadId: string; videoId: string; status: 'completed' }> {
    const session = await this.load(actor, uploadId);
    const videoId = session.videoId;
    if (!videoId) throw new Conflict('This upload has no video.');

    if (session.status === 'completed') {
      await this.producer.enqueue('video.probe', { videoId }, { createdBy: actor.accountId });
      return { uploadId, videoId, status: 'completed' };
    }
    if (!ACTIVE.includes(session.status)) throw new Conflict(`This upload is ${session.status}.`);

    await this.db
      .update(uploadSessions)
      .set({ status: 'completing' })
      .where(eq(uploadSessions.id, session.id));

    const plan = planParts(session.sizeBytes, session.partSizeBytes);
    let parts: PartInfo[] = [];
    let alreadyAssembled = false;
    try {
      parts = await this.originals.listParts(session.storageKey, session.s3UploadId);
    } catch (error) {
      if (!(error instanceof NotFound)) throw error;
      // The multipart upload is gone: either it was completed by an earlier attempt that crashed, or it never existed.
      const head = await this.originals.head(session.storageKey);
      if (!head) {
        await this.fail(session, 'The upload could not be found. Upload the file again.');
        throw new Conflict('The upload could not be found. Upload the file again.');
      }
      alreadyAssembled = true;
    }

    if (!alreadyAssembled) {
      const total = parts.reduce((sum, part) => sum + (part.sizeBytes ?? 0), 0);
      const check = verifyCompletedParts(plan, parts);
      const extra = parts.some((part) => part.partNumber > plan.totalParts);
      if (!check.ok && check.mismatched.length === 0 && !extra) {
        await this.db
          .update(uploadSessions)
          .set({ status: 'uploading' })
          .where(eq(uploadSessions.id, session.id));
        throw new UploadIncomplete(check.missing);
      }
      if (!check.ok || extra || total !== session.sizeBytes) {
        await this.originals
          .abortMultipart(session.storageKey, session.s3UploadId)
          .catch(() => undefined);
        await this.fail(
          session,
          'The uploaded size did not match the file size. Upload the file again.',
        );
        throw new ValidationFailed({ size: ['The uploaded size did not match the file size.'] });
      }
      await this.originals.completeMultipart(session.storageKey, session.s3UploadId, parts);
    }

    const head = await this.originals.head(session.storageKey);
    if (!head || head.bytes !== session.sizeBytes) {
      await this.originals.delete(session.storageKey).catch(() => undefined);
      await this.fail(session, 'The stored file size did not match. Upload the file again.');
      throw new ValidationFailed({ size: ['The stored file size did not match.'] });
    }

    const cleanup = await this.db.transaction(async (tx) => {
      const [video] = await tx.select().from(videos).where(eq(videos.id, videoId)).for('update');
      const replacedKey =
        video?.originalKey && video.originalKey !== session.storageKey ? video.originalKey : null;
      const oldPrefix = replacedKey ? video!.mediaPrefix : null;
      await tx
        .update(uploadSessions)
        .set({ status: 'completed', completedAt: this.clock(), errorMessage: null })
        .where(eq(uploadSessions.id, session.id));
      if (replacedKey) {
        await tx.delete(renditions).where(eq(renditions.videoId, videoId));
        await tx.delete(videoKeys).where(eq(videoKeys.videoId, videoId));
      }
      await tx
        .update(videos)
        .set({
          status: 'uploaded',
          originalKey: session.storageKey,
          originalBytes: session.sizeBytes,
          failureCode: null,
          failureMessage: null,
          durationMs: replacedKey ? null : video?.durationMs,
          ...(replacedKey ? { mediaPrefix: mediaPrefix() } : {}),
          updatedAt: this.clock(),
        })
        .where(eq(videos.id, videoId));
      return { replacedKey, oldPrefix };
    });

    if (cleanup.replacedKey) {
      await this.originals
        .delete(cleanup.replacedKey)
        .catch((err: unknown) => this.logger.warn('old source not removed', { err }));
      await this.originals.deletePrefix(`templates/${videoId}/`).catch(() => undefined);
      if (cleanup.oldPrefix) {
        await this.media
          .deletePrefix(`v/${cleanup.oldPrefix}/`)
          .catch((err: unknown) => this.logger.warn('old renditions not removed', { err }));
      }
    }

    // A failure here leaves the session completed, so the client retries complete and the queue write is repeated safely.
    await this.producer.enqueue('video.probe', { videoId }, { createdBy: actor.accountId });
    return { uploadId, videoId, status: 'completed' };
  }

  private async fail(session: SessionRow, message: string): Promise<void> {
    await this.db
      .update(uploadSessions)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(uploadSessions.id, session.id));
    if (session.videoId) {
      await this.db
        .update(videos)
        .set({
          status: 'failed',
          failureCode: 'upload_incomplete',
          failureMessage: message,
          updatedAt: this.clock(),
        })
        .where(and(eq(videos.id, session.videoId), sql`${videos.originalKey} IS NULL`));
    }
  }

  /** Cancels an open upload. A draft that never had a source is removed with it (M13-S11). */
  async abort(actor: Actor, uploadId: string): Promise<void> {
    const session = await this.load(actor, uploadId);
    if (session.status === 'completed')
      throw new Conflict('This upload already finished. Remove the video instead.');
    if (session.status === 'aborted' || session.status === 'expired') return;
    await this.originals
      .abortMultipart(session.storageKey, session.s3UploadId)
      .catch((error: unknown) => {
        if (!(error instanceof NotFound)) throw error;
      });
    await this.db
      .update(uploadSessions)
      .set({ status: 'aborted' })
      .where(eq(uploadSessions.id, session.id));
    await this.removeEmptyDraft(session);
  }

  private async removeEmptyDraft(session: SessionRow): Promise<void> {
    if (!session.videoId) return;
    await this.db
      .delete(videos)
      .where(
        and(
          eq(videos.id, session.videoId),
          eq(videos.status, 'uploading'),
          sql`${videos.originalKey} IS NULL`,
        ),
      );
  }

  /** The `uploads.cleanup` job. Returns counts so the job can fail loudly when an abort keeps failing. */
  async cleanupExpired(): Promise<{ expired: number; failed: number }> {
    const stale = await this.db
      .select()
      .from(uploadSessions)
      .where(
        and(inArray(uploadSessions.status, ACTIVE), lt(uploadSessions.expiresAt, this.clock())),
      );
    let expired = 0;
    let failed = 0;
    for (const session of stale) {
      try {
        await this.originals
          .abortMultipart(session.storageKey, session.s3UploadId)
          .catch((error: unknown) => {
            if (!(error instanceof NotFound)) throw error;
          });
        await this.db
          .update(uploadSessions)
          .set({ status: 'expired', errorMessage: 'The upload was idle for too long.' })
          .where(eq(uploadSessions.id, session.id));
        await this.removeEmptyDraft(session);
        expired++;
      } catch (error) {
        failed++;
        this.logger.error('could not abort an idle upload', { uploadId: session.id, err: error });
      }
    }
    return { expired, failed };
  }
}
