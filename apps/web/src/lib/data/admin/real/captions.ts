import 'server-only';
import { clearCaptionOverride, getAdminVideo, listAdminCaptionRows } from '@ad/catalog';
import { schema } from '@ad/db';
import { CaptionNeedsConfirmation, ensureTrack, type CaptionRow } from '@ad/video';
import { Conflict, Forbidden, NotFound, ValidationFailed, localeInfo } from '@ad/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Cue } from '@/lib/admin/cues';
import { changesSinceApproval } from '@/lib/admin/cues';
import { adminRuntime } from '@/server/admin/runtime';
import { cueListProblem } from '../caption-commands';
import type { BulkIssue } from '../bulk';
import { BULK_DENIED, WARNINGS_REASON, planBulkApprove } from '../caption-commands';
import type { CaptionRow as CaptionListRow, CaptionService } from '../services';
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

/** The language spoken in the video, which is the track the plain captions screens work on. */
async function spokenOf(videoId: string): Promise<string> {
  const [row] = await adminRuntime()
    .db()
    .select({ language: schema.videos.language })
    .from(schema.videos)
    .where(eq(schema.videos.id, videoId))
    .limit(1);
  return row?.language || 'en';
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
    const shaped = rows.map((row): CaptionListRow => ({
      videoId: row.videoId,
      title: row.title,
      state: row.state,
      language: localeInfo(row.spokenLanguage)?.englishName ?? row.spokenLanguage,
      spokenLanguage: row.spokenLanguage,
      translations: row.translations,
      cueCount: row.cueCount,
      lastEditedBy: row.updatedAt
        ? (row.updatedBy && names.get(row.updatedBy)) || 'Automatic'
        : 'Not started',
      lastEditedAt: row.updatedAt,
      // Cue warnings are only known when the cues are read, so approveMany skips those at approval time.
      warnings: 0,
      untouchedAuto: row.untouchedAuto,
    }));
    const filtered = filter?.state ? shaped.filter((r) => r.state === filter.state) : shaped;
    const time = (value: string | null) => (value ? Date.parse(value) : Number.POSITIVE_INFINITY);
    return filtered.sort((a, b) => time(a.lastEditedAt) - time(b.lastEditedAt));
  },

  async track(actor, videoId, language) {
    need(actor, 'caption.review');
    const ctx = await context();
    const who = catalogActor(actor);
    const video = await toRecord(actor, await getAdminVideo(ctx, who, videoId));
    const service = await adminRuntime().captions();
    const spoken = await spokenOf(videoId);
    if (language && language !== spoken) return translationTrack(actor, video, language, spoken);
    const summary = (await service.listForVideo(who, videoId)).find((s) => s.language === spoken);
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
      language: spoken,
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

  async save(actor, videoId, cues, language) {
    need(actor, 'caption.review');
    const who = catalogActor(actor);
    await getAdminVideo(await context(), who, videoId);
    const service = await adminRuntime().captions();
    if (await working(videoId)) return { ok: false, error: WORKING };
    const lang = language ?? (await spokenOf(videoId));
    const summary = (await service.listForVideo(who, videoId)).find((s) => s.language === lang);
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

  async approve(actor, videoId, language) {
    need(actor, 'caption.review');
    const who = catalogActor(actor);
    const ctx = await context();
    const video = await getAdminVideo(ctx, who, videoId);
    const service = await adminRuntime().captions();
    const spoken = await spokenOf(videoId);
    if (language && language !== spoken) return approveTranslation(who, videoId, language);
    if (video.captionState === 'generating') return { ok: false, error: WORKING };
    const summary = (await service.listForVideo(who, videoId)).find((s) => s.language === spoken);
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

  async approveMany(actor, ids) {
    need(actor, 'caption.approve_bulk');
    const who = catalogActor(actor);
    const ctx = await context();
    const service = await adminRuntime().captions();
    const out = { succeeded: [] as string[], failed: [] as BulkIssue[], skipped: [] as BulkIssue[] };
    for (const id of ids) {
      try {
        const video = await getAdminVideo(ctx, who, id);
        const spokenLang = await spokenOf(id);
        const summary = (await service.listForVideo(who, id)).find((s) => s.language === spokenLang);
        const state = summary?.latestRevisionId || video.captionState !== 'none' ? video.captionState : 'none';
        const plan = planBulkApprove([
          { videoId: id, state, warnings: 0, untouchedAuto: false },
        ]);
        if (plan.skipped[0]) {
          out.skipped.push(plan.skipped[0]);
          continue;
        }
        if (!summary?.latestRevisionId) {
          out.skipped.push({ id, reason: 'No captions yet.' });
          continue;
        }
        await service.approve(who, summary.latestRevisionId, { confirmWarnings: false });
        await clearCaptionOverride(ctx, who, id);
        out.succeeded.push(id);
      } catch (error) {
        if (error instanceof CaptionNeedsConfirmation) out.skipped.push({ id, reason: WARNINGS_REASON });
        else if (error instanceof Forbidden) out.failed.push({ id, reason: BULK_DENIED, retryable: false });
        else if (error instanceof NotFound)
          out.failed.push({ id, reason: 'This video no longer exists.', retryable: false });
        else if (error instanceof Conflict || error instanceof ValidationFailed)
          out.failed.push({ id, reason: reasonOf(error) ?? 'Could not approve.', retryable: false });
        else out.failed.push({ id, reason: 'Could not approve. Try again.', retryable: true });
      }
    }
    return out;
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

  async upload(actor, videoId, cues, language) {
    need(actor, 'caption.review');
    const who = catalogActor(actor);
    await getAdminVideo(await context(), who, videoId);
    const problem = cueListProblem(cues);
    if (problem) return { ok: false, error: problem };
    const service = await adminRuntime().captions();
    try {
      const lang = language ?? (await spokenOf(videoId));
      const track = await ensureTrack(adminRuntime().db(), videoId, lang);
      await service.saveRevision(who, track.id, toVtt(cues));
      return { ok: true };
    } catch (error) {
      const reason = reasonOf(error);
      if (reason) return { ok: false, error: reason };
      throw error;
    }
  },

  async translate(actor, videoId, language) {
    need(actor, 'caption.translate');
    await getAdminVideo(await context(), catalogActor(actor), videoId);
    try {
      await (await adminRuntime().captions()).requestTranslation(catalogActor(actor), videoId, language);
      return { ok: true };
    } catch (error) {
      const reason = reasonOf(error);
      if (reason) return { ok: false, error: reason };
      throw error;
    }
  },

  async estimate(actor, videoId, language) {
    need(actor, 'caption.translate');
    await getAdminVideo(await context(), catalogActor(actor), videoId);
    return (await adminRuntime().captions()).estimateTranslation(catalogActor(actor), videoId, language);
  },

  async setPublished(actor, videoId, language, published) {
    need(actor, 'caption.publish_language');
    await getAdminVideo(await context(), catalogActor(actor), videoId);
    try {
      await (await adminRuntime().captions()).setPublished(catalogActor(actor), videoId, language, published);
      return { ok: true };
    } catch (error) {
      const reason = reasonOf(error);
      if (reason) return { ok: false, error: reason };
      throw error;
    }
  },
};

/** A translated track: its cues, the approved spoken language cues beside them, and its publish state. */
async function translationTrack(
  actor: Parameters<CaptionService['track']>[0],
  video: Awaited<ReturnType<CaptionService['track']>>['video'],
  language: string,
  spoken: string,
): Promise<Awaited<ReturnType<CaptionService['track']>>> {
  const who = catalogActor(actor);
  const service = await adminRuntime().captions();
  const summaries = await service.listForVideo(who, video.id);
  const summary = summaries.find((s) => s.language === language);
  if (!summary?.latestRevisionId) return { track: null, video };
  const loaded = await service.getRevision(who, summary.latestRevisionId);
  const cues = toUi(loaded.cues, loaded.lowConfidence);
  let approved: CaptionRow | null = null;
  let approvedCues: Cue[] | null = null;
  if (summary.approvedRevisionId) {
    if (summary.approvedRevisionId === summary.latestRevisionId) {
      approved = loaded.caption;
      approvedCues = cues.map((c) => ({ ...c }));
    } else {
      const earlier = await service.getRevision(who, summary.approvedRevisionId);
      approved = earlier.caption;
      approvedCues = toUi(earlier.cues);
    }
  }
  const spokenSummary = summaries.find((s) => s.language === spoken);
  const sourceCues = spokenSummary?.approvedRevisionId
    ? toUi((await service.getRevision(who, spokenSummary.approvedRevisionId)).cues)
    : [];
  const state = await service.translationState(video.id, language);
  const ids = [loaded.caption.createdBy, approved?.reviewedBy].filter((id): id is string => Boolean(id));
  const names = await adminRuntime().names(who, ids);
  const nameOf = (id: string | null | undefined, fallback: string) => (id && names.get(id)) || fallback;
  const track: CaptionTrack = {
    videoId: video.id,
    language,
    state: summary.state === 'approved' ? 'approved' : 'needs_review',
    cues,
    source: loaded.caption.source === 'manual' ? 'manual' : 'whisper',
    approvedBy: approved ? nameOf(approved.reviewedBy, 'Unknown') : null,
    approvedAt: approved?.reviewedAt ? approved.reviewedAt.toISOString() : null,
    approvedCues,
    updatedBy: nameOf(loaded.caption.createdBy, 'Automatic'),
    updatedAt: loaded.caption.createdAt.toISOString(),
    failure: null,
    progress: null,
    translation: {
      spokenLanguage: spoken,
      sourceCues,
      published: state.published,
      sourceChanged: state.sourceChanged,
    },
  };
  return { track, video };
}

/** Approving a translation never publishes it. Warnings are confirmed here as for the spoken track. */
async function approveTranslation(
  who: ReturnType<typeof catalogActor>,
  videoId: string,
  language: string,
) {
  const service = await adminRuntime().captions();
  const summary = (await service.listForVideo(who, videoId)).find((s) => s.language === language);
  if (!summary?.latestRevisionId) return { ok: false as const, error: NO_CAPTIONS };
  try {
    if (summary.state !== 'approved')
      await service.approve(who, summary.latestRevisionId, { confirmWarnings: true });
    return { ok: true as const };
  } catch (error) {
    const reason = reasonOf(error);
    if (reason) return { ok: false as const, error: reason };
    throw error;
  }
}
