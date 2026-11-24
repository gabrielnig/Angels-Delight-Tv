import { SPONSOR_SLOTS } from '@ad/shared';
import { z } from 'zod';
import { DEVICE_CLASSES, EVENT_SCHEMA_VERSION, VITAL_NAMES, type DeviceClass } from './constants';

export { DEVICE_CLASSES, EVENT_SCHEMA_VERSION, VITAL_NAMES, type DeviceClass } from './constants';
export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_BODY_BYTES = 16 * 1024;
/** Six hours. A single play cannot accumulate more than this. */
const MAX_WATCH_MS = 6 * 60 * 60 * 1000;

const id = z.uuid();
const ms = z.number().int().min(0).max(MAX_WATCH_MS);
const height = z.number().int().min(0).max(4320);

const base = { playId: id, videoId: id };

export const viewStartEvent = z.strictObject({
  kind: z.literal('view_start'),
  ...base,
  maxHeight: height.optional(),
});
export const progressEvent = z.strictObject({
  kind: z.literal('progress'),
  ...base,
  /** Seconds actually played so far in this play session, in ms. Seek jumps do not add to it. */
  watchedMs: ms,
  positionMs: ms,
  maxHeight: height.optional(),
});
export const completeEvent = z.strictObject({
  kind: z.literal('complete'),
  ...base,
  watchedMs: ms,
  maxHeight: height.optional(),
});
export const searchEvent = z.strictObject({
  kind: z.literal('search'),
  resultCount: z.number().int().min(0).max(10_000),
  query: z.string().max(200).optional(),
});
export const errorEvent = z.strictObject({
  kind: z.literal('error'),
  /** A code from our own taxonomy, for example `player.network`. Never a message. */
  code: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,39}$/),
  videoId: id.optional(),
});
export const vitalsEvent = z.strictObject({
  kind: z.literal('vitals'),
  name: z.enum(VITAL_NAMES),
  value: z.number().min(0).max(600_000),
  /** Route template such as `/watch/[slug]`, never a concrete URL. */
  route: z.string().regex(/^\/[A-Za-z0-9/_\-[\].]{0,79}$/),
});
export const startupEvent = z.strictObject({
  kind: z.literal('startup'),
  videoId: id,
  startupMs: z.number().int().min(0).max(120_000),
  rebufferMs: z.number().int().min(0).max(MAX_WATCH_MS).optional(),
});

/** Stall time since the last report for this play, so the dashboard can show a true rebuffer ratio (M08-S30). */
export const rebufferEvent = z.strictObject({
  kind: z.literal('rebuffer'),
  videoId: id,
  rebufferMs: z.number().int().min(1).max(MAX_WATCH_MS),
});

/** The viewer used Skip intro, recap, credits or Next lesson (M43). Carries no identity. */
export const SKIP_KINDS = ['intro', 'recap', 'credits', 'next'] as const;
export const skipEvent = z.strictObject({
  kind: z.literal('skip'),
  videoId: id,
  skipKind: z.enum(SKIP_KINDS),
  fromMs: z.number().int().min(0).max(MAX_WATCH_MS),
  toMs: z.number().int().min(0).max(MAX_WATCH_MS),
});

/**
 * A sponsor card was in view (M48-S15). Clicks are never an event: only the redirect route at /s/{id} records them,
 * so the client cannot inflate them.
 */
export const sponsorImpressionEvent = z.strictObject({
  kind: z.literal('sponsor_impression'),
  creativeId: id,
  slot: z.enum(SPONSOR_SLOTS),
  /** One per card per page view. Repeats in a batch count once. */
  impressionId: id,
});

export const analyticsEvent = z.discriminatedUnion('kind', [
  viewStartEvent,
  progressEvent,
  completeEvent,
  searchEvent,
  errorEvent,
  vitalsEvent,
  startupEvent,
  rebufferEvent,
  skipEvent,
  sponsorImpressionEvent,
]);
export type AnalyticsEvent = z.infer<typeof analyticsEvent>;
export type AnalyticsEventKind = AnalyticsEvent['kind'];

const envelope = z.object({
  v: z.literal(EVENT_SCHEMA_VERSION),
  deviceClass: z.enum(DEVICE_CLASSES).optional(),
  saveData: z.boolean().optional(),
  /** An admin preview. The server drops the whole batch (M19-S01). */
  preview: z.boolean().optional(),
  events: z.array(z.unknown()).max(MAX_EVENTS_PER_BATCH),
});

export type ParsedBatch =
  | {
      ok: true;
      events: AnalyticsEvent[];
      rejected: number;
      deviceClass: DeviceClass | undefined;
      saveData: boolean | undefined;
      preview: boolean;
    }
  | { ok: false };

/** Validates a batch. A bad envelope fails the batch, a bad event is dropped and counted. */
export function parseBatch(input: unknown): ParsedBatch {
  const head = envelope.safeParse(input);
  if (!head.success) return { ok: false };
  const events: AnalyticsEvent[] = [];
  let rejected = 0;
  for (const raw of head.data.events) {
    const parsed = analyticsEvent.safeParse(raw);
    if (parsed.success) events.push(parsed.data);
    else rejected += 1;
  }
  return {
    ok: true,
    events,
    rejected,
    deviceClass: head.data.deviceClass,
    saveData: head.data.saveData,
    preview: head.data.preview === true,
  };
}

const MAX_QUERY_LENGTH = 60;
const EMAIL_LIKE = /\S+@\S+/;
const LONG_DIGITS = /\d{6,}/;

/** Search text kept for the "searches with no results" report. Anything that looks personal is dropped. */
export function normalizeSearchQuery(raw: string): string | null {
  const text = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text || EMAIL_LIKE.test(text) || LONG_DIGITS.test(text.replace(/[\s()+-]/g, ''))) {
    return null;
  }
  return text.slice(0, MAX_QUERY_LENGTH);
}
