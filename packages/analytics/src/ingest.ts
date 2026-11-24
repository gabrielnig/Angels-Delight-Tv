import { lagosDay } from './day';
import type { AnalyticsEvent, DeviceClass } from './events';
import { normalizeSearchQuery, parseBatch } from './events';
import { bucketLabel, STARTUP_EDGES_MS, vitalEdges } from './histogram';
import { classifyDevice, isBot, viewerHash } from './identity';
import { ANALYTICS_LIMITS, type BucketPolicy, type RateLimiter } from './rate-limit';

export interface ViewUpsert {
  playId: string;
  videoId: string;
  profileId: string | null;
  audience: 'general' | 'kids';
  startedAt: Date;
  watchedMs: number;
  completed: boolean;
  maxHeight: number | null;
  country: string | null;
  viewerHash: string | null;
  deviceClass: DeviceClass;
  saveData: boolean | null;
}

export interface CounterBump {
  day: string;
  kind: string;
  key: string;
  by?: number;
}

export interface EventStore {
  /** Inserts or advances a play. `created` is true only for the call that made the row. */
  upsertView(row: ViewUpsert): Promise<{ created: boolean }>;
  bump(entry: CounterBump): Promise<void>;
}

/** What the route knows about the request. The profile and audience come from the session, never from the body. */
export interface IngestContext {
  userAgent: string | null;
  /** From the CDN country header. No IP is stored. */
  country: string | null;
  /** Truncated IP used only as a rate limit key. */
  ipKey: string;
  profileId: string | null;
  audience: 'general' | 'kids';
  /**
   * A guest's id from the signed guest cookie (M40-S16). Only ever hashed with the day, never stored. A signed in
   * profile wins over it. A Kids mode guest stores no identity at all.
   */
  subjectId?: string | null;
}

export interface IngestInput {
  body: unknown;
  context: IngestContext;
  store: EventStore;
  limiter: RateLimiter;
  secret: Uint8Array;
  now?: () => Date;
}

export interface IngestResult {
  status: 202 | 400 | 429;
  retryAfterSeconds?: number;
}

const COUNTRY = /^[A-Z]{2}$/;
const NOT_A_COUNTRY = new Set(['XX', 'T1', 'ZZ']);

function cleanCountry(value: string | null): string | null {
  const upper = value?.toUpperCase() ?? null;
  return upper && COUNTRY.test(upper) && !NOT_A_COUNTRY.has(upper) ? upper : null;
}

/**
 * Validates, rate limits and records a batch of events. Storage problems are swallowed: analytics must never
 * affect playback, and the client cannot do anything about a server side failure anyway.
 */
export async function ingestBatch(input: IngestInput): Promise<IngestResult> {
  const parsed = parseBatch(input.body);
  if (!parsed.ok) return { status: 400 };

  const now = (input.now ?? (() => new Date()))();
  const { context } = input;

  const subjects: Array<[BucketPolicy, string]> = [[ANALYTICS_LIMITS.perIp, context.ipKey]];
  if (context.profileId) subjects.push([ANALYTICS_LIMITS.perProfile, context.profileId]);
  for (const [policy, subject] of subjects) {
    // Analytics fails open: a broken limiter store must not stop events or playback.
    const verdict = await input.limiter
      .consume(policy, subject)
      .catch(() => ({ allowed: true, retryAfterSeconds: 0 }));
    if (!verdict.allowed) return { status: 429, retryAfterSeconds: verdict.retryAfterSeconds };
  }

  if (parsed.preview || isBot(context.userAgent)) return { status: 202 };

  const deviceClass = parsed.deviceClass ?? classifyDevice(context.userAgent);
  const saveData = parsed.saveData ?? null;
  const connection = saveData ? 'save_data' : 'std';
  const day = lagosDay(now);
  const country = cleanCountry(context.country);
  const kids = context.audience === 'kids';

  const bump = (kind: string, key: string, by = 1) =>
    input.store.bump({ day, kind, key, by }).catch(() => undefined);

  const handle = async (event: AnalyticsEvent): Promise<void> => {
    switch (event.kind) {
      case 'view_start':
      case 'progress':
      case 'complete': {
        const watchedMs = event.kind === 'view_start' ? 0 : event.watchedMs;
        const startedAt = event.kind === 'view_start' ? now : new Date(now.getTime() - watchedMs);
        const profileId = kids ? null : context.profileId;
        const subjectId = kids ? null : (context.subjectId ?? null);
        const { created } = await input.store.upsertView({
          playId: event.playId,
          videoId: event.videoId,
          profileId,
          audience: context.audience,
          startedAt,
          watchedMs,
          completed: event.kind === 'complete',
          maxHeight: event.maxHeight ?? null,
          country,
          viewerHash: profileId
            ? viewerHash(input.secret, lagosDay(startedAt), profileId)
            : subjectId
              ? viewerHash(input.secret, lagosDay(startedAt), `guest:${subjectId}`)
              : null,
          deviceClass,
          saveData,
        });
        if (created) {
          await bump('device', deviceClass);
          await bump('connection', connection);
          if (country) await bump('country', country);
        }
        return;
      }
      case 'search': {
        await bump('search', 'all');
        if (event.resultCount === 0) {
          await bump('search', 'empty');
          const query = event.query ? normalizeSearchQuery(event.query) : null;
          if (query) await bump('search_empty', query);
        }
        return;
      }
      case 'error':
        await bump('error', event.code);
        return;
      case 'vitals':
        await bump(
          `vitals_${event.name}`,
          `${bucketLabel(vitalEdges(event.name), event.value)}|${deviceClass}|${connection}`,
        );
        return;
      case 'startup':
        await bump(
          'startup',
          `${bucketLabel(STARTUP_EDGES_MS, event.startupMs)}|${deviceClass}|${connection}`,
        );
        if (event.rebufferMs) await bump('rebuffer_ms', 'all', event.rebufferMs);
        return;
      case 'rebuffer':
        await bump('rebuffer_ms', 'all', event.rebufferMs);
        return;
      case 'skip':
        await bump('skip', event.skipKind);
        return;
    }
  };

  for (const event of parsed.events) {
    try {
      await handle(event);
    } catch {
      // A failed write for one event must not lose the rest of the batch.
    }
  }
  return { status: 202 };
}
