import 'server-only';
import { clearCaptionOverride, getAdminVideo, listAdminCaptionRows } from '@ad/catalog';
import { schema } from '@ad/db';
import { CaptionNeedsConfirmation, ensureTrack, type CaptionRow } from '@ad/video';
import { Conflict, Forbidden, NotFound, ValidationFailed } from '@ad/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Cue } from '@/lib/admin/cues';
import { changesSinceApproval } from '@/lib/admin/cues';
import { adminRuntime } from '@/server/admin/runtime';
import { cueListProblem } from '../caption-commands';
import type { CaptionService } from '../services';
import type { CaptionTrack } from '../types';
import { catalogActor, context, need, toRecord } from './shared';

type VttCue = { startMs: number; endMs: number; text: string };
const toUi = (cues: VttCue[], flagged: readonly number[] = []): Cue[] =>
  cues.map((c, i) => ({
    id: `cue_${i + 1}`,
    start: c.startMs,
    end: c.endMs,
    text: c.text,
    ...(flagged.includes(c.startMs) ? { lowConfidence: true } : {}),
  }));
const toVtt = (cues: Cue[]): VttCue[] =>
  cues.map((c) => ({ startMs: c.start, endMs: c.end, text: c.text }));

const NO_CAPTIONS = 'This video has no captions yet.';
const WORKING = 'Captions are still being made.';

/** Rough progress for a running caption job: five steps, with minutes left from the video length. */
function progressOf(percent: number, durationSeconds: number) {
  const of = 5;
  const step = Math.min(of, Math.max(1, Math.ceil((percent / 100) * of) || 1));
  const minutesLeft = Math.max(1, Math.ceil(((durationSeconds / 60) * (100 - percent)) / 100 / 2));
  return { step, of, minutesLeft };
}

async function lastGenerateJob(videoId: string) {
  const [job] = await adminRuntime()
    .db()
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.queue, 'caption.generate'), eq(schema.jobs.videoId, videoId)))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(1);
  return job ?? null;
}

async function working(videoId: string) {
  const [open] = await adminRuntime()
    .db()
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.queue, 'caption.generate'),
        eq(schema.jobs.videoId, videoId),
        inArray(schema.jobs.status, ['queued', 'running']),
      ),
    )
    .limit(1);
  return Boolean(open);
}

function reasonOf(error: unknown): string | null {
  if (error instanceof Forbidden) return 'You do not have permission to edit captions.';
  if (error instanceof ValidationFailed)
    return Object.values(error.fields)[0]?.[0] ?? 'Check the captions and try again.';
  if (error instanceof Conflict) return error.message;
  if (error instanceof NotFound) return error.message;
  return null;
}

export const realCaptionService: CaptionService = {
  async list(actor, filter) {
    need(actor, 'caption.review');
    const rows = await listAdminCaptionRows(await context(), catalogActor(actor));
    const names = await adminRuntime().names(
      catalogActor(actor),
      rows.map((r) => r.updatedBy).filter((id): id is string => Boolean(id)),
    );
    const shaped = rows.map((row) => ({
      videoId: row.videoId,
      title: row.title,
      state: row.state,
      language: 'English',
      cueCount: row.cueCount,
      lastEditedBy: row.updatedAt
        ? (row.updatedBy && names.get(row.updatedBy)) || 'Automatic'
        : 'Not started',
      lastEditedAt: row.updatedAt,
    }));
    const filtered = filter?.state ? shaped.filter((r) => r.state === filter.state) : shaped;
    const time = (value: string | null) => (value ? Date.parse(value) : Number.POSITIVE_INFINITY);
    return filtered.sort((a, b) => time(a.lastEditedAt) - time(b.lastEditedAt));
  },

  async track(actor, videoId) {
    need(actor, 'caption.review');
    const ctx = await context();
    const who = catalogActor(actor);
    const video = await toRecord(actor, await getAdminVideo(ctx, who, videoId));
    const service = await adminRuntime().captions();
    const summary = (await service.listForVideo(who, videoId)).find((s) => s.language === 'en');
    const state = video.captionState;
    if (!summary?.latestRevisionId) {
      if (state !== 'generating' && state !== 'failed') return { track: null, video };
    }

    let cues: Cue[] = [];
    let approvedCues: Cue[] | null = null;
    let latest: CaptionRow | null = null;
    let approved: CaptionRow | null = null;
    if (summary?.latestRevisionId && state !== 'generating') {
      const loaded = await service.getRevision(who, summary.latestRevisionId);
      latest = loaded.caption;
      cues = toUi(loaded.cues, loaded.lowConfidence);
      if (summary.approvedRevisionId) {
        if (summary.approvedRevisionId === summary.latestRevisionId) approved = latest;
        else {
          const earlier = await service.getRevision(who, summary.approvedRevisionId);
          approved = earlier.caption;
          approvedCues = toUi(earlier.cues);
        }
        approvedCues ??= cues.map((c) => ({ ...c }));
      }
    } else if (summary?.approvedRevisionId) {
      const earlier = await service.getRevision(who, summary.approvedRevisionId);
      approved = earlier.caption;
      approvedCues = toUi(earlier.cues);
    }

    const ids = [latest?.createdBy, approved?.reviewedBy, latest?.reviewedBy].filter(
      (id): id is string => Boolean(id),
    );
    const names = await adminRuntime().names(who, ids);
    const nameOf = (id: string | null | undefined, fallback: string) =>
      (id && names.get(id)) || fallback;
    const job =
      state === 'generating' || state === 'failed' ? await lastGenerateJob(videoId) : null;

    const track: CaptionTrack = {
      videoId,
      language: 'en',
      state,
      cues,
      source:
        latest && (latest.source === 'manual' || latest.source === 'translation')
          ? 'manual'
          : 'whisper',
      approvedBy: approved ? nameOf(approved.reviewedBy, 'Unknown') : null,
      approvedAt: approved?.reviewedAt ? approved.reviewedAt.toISOString() : null,
      approvedCues,
      updatedBy: latest ? nameOf(latest.createdBy, 'Automatic') : 'Automatic',
      updatedAt: (latest?.createdAt ?? job?.createdAt ?? new Date()).toISOString(),
      failure: state === 'failed' ? (job?.errorMessage ?? 'Captions could not be made.') : null,
      progress:
        state === 'generating'
          ? progressOf(job?.progress ?? 0, video.durationSeconds || 240)
          : null,
    };
    return { track, video };
  },

  async save(actor, videoId, cues) {
    need(actor, 'caption.review');
    const who = catalogActor(actor);
    await getAdminVideo(await context(), who, videoId);
    const service = await adminRuntime().captions();
    if (await working(videoId)) return { ok: false, error: WORKING };
    const summary = (await service.listForVideo(who, videoId)).find((s) => s.language === 'en');
    if (!summary?.latestRevisionId) return { ok: false, error: NO_CAPTIONS };
    const problem = cueListProblem(cues);
    if (problem) return { ok: false, error: problem };
    try {
      await service.saveRevision(who, summary.trackId, toVtt(cues));
      let changes = 0;
      if (summary.approvedRevisionId) {
        const approved = await service.getRevision(who, summary.approvedRevisionId);
        changes = changesSinceApproval(toUi(approved.cues), cues);
      }
      return { ok: true, changesSinceApproval: changes };
    } catch (error) {
      const reason = reasonOf(error);
      if (reason) return { ok: false, error: reason };
      throw error;
    }
  },

  async approve(actor, videoId) {
    need(actor, 'caption.review');
    const who = catalogActor(actor);
    const ctx = await context();
    const video = await getAdminVideo(ctx, who, videoId);
    const service = await adminRuntime().captions();
    if (video.captionState === 'generating') return { ok: false, error: WORKING };
    const summary = (await service.listForVideo(who, videoId)).find((s) => s.language === 'en');
    if (!summary?.latestRevisionId) {
      return {
        ok: false,
        error:
          video.captionState === 'failed'
            ? 'Captions could not be made. Upload a file or try again.'
            : NO_CAPTIONS,
      };
    }
    try {
      if (video.captionState !== 'approved')
        await service.approve(who, summary.latestRevisionId, { confirmWarnings: true });
      await clearCaptionOverride(ctx, who, videoId);
      return { ok: true };
    } catch (error) {
      if (error instanceof CaptionNeedsConfirmation) return { ok: false, error: error.message };
      const reason = reasonOf(error);
      if (reason) return { ok: false, error: reason };
      throw error;
    }
  },

  async regenerate(actor, videoId) {
    need(actor, 'caption.review');
    await getAdminVideo(await context(), catalogActor(actor), videoId);
    try {
      await (await adminRuntime().captions()).regenerate(catalogActor(actor), videoId);
      return { ok: true };
    } catch (error) {
      const reason = reasonOf(error);
      if (reason) return { ok: false, error: reason };
      throw error;
    }
  },

  async previewScript(actor, script) {
    need(actor, 'caption.review');
    return (await adminRuntime().captions()).previewScript(script);
  },

  async alignScript(actor, videoId, script) {
    need(actor, 'caption.review');
    await getAdminVideo(await context(), catalogActor(actor), videoId);
    try {
      await (await adminRuntime().captions()).saveScript(catalogActor(actor), videoId, script);
      return { ok: true };
    } catch (error) {
      const reason = reasonOf(error);
      if (reason) return { ok: false, error: reason };
      throw error;
    }
  },

  async upload(actor, videoId, cues) {
    need(actor, 'caption.review');
    const who = catalogActor(actor);
    await getAdminVideo(await context(), who, videoId);
    const problem = cueListProblem(cues);
    if (problem) return { ok: false, error: problem };
    const service = await adminRuntime().captions();
    try {
      const track = await ensureTrack(adminRuntime().db(), videoId, 'en');
      await service.saveRevision(who, track.id, toVtt(cues));
      return { ok: true };
    } catch (error) {
      const reason = reasonOf(error);
      if (reason) return { ok: false, error: reason };
      throw error;
    }
  },
};
