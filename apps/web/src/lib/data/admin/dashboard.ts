import { can } from '@/lib/admin/can';
import type { AdminStore } from './store';
import type { AdminActor, TileState } from './types';
import { adminStatusOf, canPublish } from './video-rules';

const GB = 1024 ** 3;
const LAGOS_OFFSET_MS = 60 * 60_000;

export interface AttentionItem {
  id: string;
  kind: 'failed' | 'captions' | 'scheduled' | 'ready';
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
}

export interface DashboardData {
  tiles: Record<'published' | 'drafts' | 'processing' | 'failed', TileState<number>>;
  attention: AttentionItem[];
  recent: Array<{
    id: string;
    title: string;
    by: string;
    when: string;
    status: ReturnType<typeof adminStatusOf>;
  }>;
  storage: TileState<{
    usedBytes: number;
    capBytes: number;
    originalsBytes: number;
    streamingBytes: number;
    monthsLeft: number;
  }>;
  views: TileState<{
    days: Array<{ label: string; value: number }>;
    total: number;
    changePercent: number;
  }>;
  isEmpty: boolean;
}

const NUMBER_WORDS = [
  'Nothing',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
];

export function greeting(fullName: string, hour: number, count: number): string {
  const first = fullName.split(' ')[0] ?? fullName;
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  if (count === 0) return `Good ${part}, ${first}. Nothing needs you right now.`;
  const word = NUMBER_WORDS[count] ?? String(count);
  return `Good ${part}, ${first}. ${word} ${count === 1 ? 'thing needs' : 'things need'} you today.`;
}

function relativeDay(from: number, to: number): string {
  const days = Math.floor((to - from) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function minutesAgo(from: number, now: number): string {
  const minutes = Math.max(1, Math.round((now - from) / 60_000));
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} hours ago` : `${Math.round(hours / 24)} days ago`;
}

const lagosDay = (ms: number) => Math.floor((ms + LAGOS_OFFSET_MS) / 86_400_000);

export function buildDashboard(
  actor: AdminActor,
  store: AdminStore,
  options: { now?: number; failTiles?: string[] } = {},
): DashboardData {
  const now = options.now ?? Date.now();
  const failing = new Set(options.failTiles ?? []);
  const live = store.videos.filter((video) => video.deletedAt === null);
  const statusOf = (video: (typeof live)[number]) => adminStatusOf(video);

  const tile = (key: string, value: number): TileState<number> =>
    failing.has(key) ? { state: 'error' } : { state: 'ready', value };

  const attention: AttentionItem[] = [];
  for (const video of live.filter((v) => v.status === 'failed')) {
    attention.push({
      id: `failed_${video.id}`,
      kind: 'failed',
      title: `${video.title} did not finish encoding`,
      detail:
        `Failed ${minutesAgo(Date.parse(video.updatedAt), now)}. ${video.failure?.reason ?? ''}`.trim(),
      actionLabel: 'Open in Encoding',
      href: '/admin/encoding',
    });
  }
  for (const video of live.filter(
    (v) => v.captionState === 'needs_review' && v.status === 'ready',
  )) {
    const since = relativeDay(Date.parse(video.updatedAt), now);
    attention.push({
      id: `captions_${video.id}`,
      kind: 'captions',
      title: `${video.title} needs caption review`,
      detail: `${video.captionCueCount} cues waiting since ${since === 'Today' ? 'today' : since.toLowerCase()}.`,
      actionLabel: 'Review captions',
      href: `/admin/captions/${video.id}`,
    });
  }
  for (const video of live.filter(
    (v) =>
      v.publishState === 'scheduled' &&
      v.publishAt &&
      lagosDay(Date.parse(v.publishAt)) === lagosDay(now),
  )) {
    const time = new Intl.DateTimeFormat('en-NG', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Africa/Lagos',
    }).format(new Date(video.publishAt!));
    attention.push({
      id: `scheduled_${video.id}`,
      kind: 'scheduled',
      title: `${video.title} goes live today at ${time.toUpperCase()}`,
      detail: `Scheduled by ${video.uploadedBy}. Africa/Lagos time.`,
      actionLabel: 'View',
      href: `/admin/videos/${video.id}`,
    });
  }
  for (const video of live.filter(
    (v) => statusOf(v) === 'ready' && v.publishState !== 'published',
  )) {
    if (canPublish(video, store.settings).ok) {
      attention.push({
        id: `ready_${video.id}`,
        kind: 'ready',
        title: `${video.title} is ready to publish`,
        detail: 'All checks passed. Waiting for a decision.',
        actionLabel: 'Publish',
        href: `/admin/videos/${video.id}`,
      });
    }
  }

  const days = store.dailyViews.slice(-7);
  const previous = store.dailyViews.slice(-14, -7);
  const total = days.reduce((sum, value) => sum + value, 0);
  const before = previous.reduce((sum, value) => sum + value, 0);
  const labels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - (7 - index) * 86_400_000);
    return new Intl.DateTimeFormat('en-NG', { weekday: 'short', timeZone: 'Africa/Lagos' }).format(
      date,
    );
  });

  const original = live.reduce((sum, video) => sum + video.sizeBytes, 0);
  const streaming = Math.round(original * 0.55);

  const recent = [...live]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 4)
    .map((video) => ({
      id: video.id,
      title: video.title,
      by: video.uploadedBy.split(' ')[0] ?? video.uploadedBy,
      when: relativeDay(Date.parse(video.createdAt), now),
      status: statusOf(video),
    }));

  return {
    tiles: {
      published: tile('published', live.filter((v) => v.publishState === 'published').length),
      drafts: tile(
        'drafts',
        live.filter((v) => ['draft', 'ready', 'needs_captions'].includes(statusOf(v))).length,
      ),
      processing: tile('processing', live.filter((v) => statusOf(v) === 'processing').length),
      failed: tile('failed', live.filter((v) => v.status === 'failed').length),
    },
    attention,
    recent,
    storage: !can(actor.role, 'system.view')
      ? { state: 'forbidden' }
      : failing.has('storage')
        ? { state: 'error' }
        : {
            state: 'ready',
            value: {
              usedBytes: original + streaming,
              capBytes: 200 * GB,
              originalsBytes: original,
              streamingBytes: streaming,
              monthsLeft: 9,
            },
          },
    views: !can(actor.role, 'analytics.view')
      ? { state: 'forbidden' }
      : failing.has('views')
        ? { state: 'error' }
        : {
            state: 'ready',
            value: {
              days: days.map((value, index) => ({ label: labels[index] ?? '', value })),
              total,
              changePercent: before ? Math.round(((total - before) / before) * 100) : 0,
            },
          },
    isEmpty: live.length === 0,
  };
}
