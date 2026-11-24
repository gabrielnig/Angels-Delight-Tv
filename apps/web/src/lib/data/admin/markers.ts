import 'server-only';
import { Forbidden, NotFound, ValidationFailed, isStaffRole } from '@ad/shared';
import {
  validateChapters,
  validateMarkers,
  type ChapterInput,
  type MarkerInput,
} from '@ad/video/markers';
import { adminDataMode } from './mode';
import { getStore } from './store';
import type { AdminActor } from './types';

export interface MarkerPayload {
  markers: MarkerInput[];
  chapters: ChapterInput[];
}

export interface MarkerSibling {
  id: string;
  title: string;
  label: string;
  markers: MarkerInput[];
}

export interface MarkerSnapshot extends MarkerPayload {
  durationMs: number | null;
}

export interface MarkersAdminService {
  get(actor: AdminActor, videoId: string): Promise<MarkerSnapshot>;
  siblings(actor: AdminActor, videoId: string): Promise<MarkerSibling[]>;
  save(actor: AdminActor, videoId: string, payload: MarkerPayload): Promise<void>;
}

const KEY = Symbol.for('ad.admin.fixture.markers');
type Held = Map<string, MarkerPayload>;
const held = (): Held => {
  const holder = globalThis as unknown as Record<symbol, Held | undefined>;
  return (holder[KEY] ??= new Map());
};

function fixtureDuration(videoId: string): number {
  const video = getStore().videos.find((v) => v.id === videoId);
  if (!video) throw new NotFound('Video not found');
  return video.durationSeconds * 1000;
}

function need(actor: AdminActor): void {
  if (!isStaffRole(actor.role)) throw new Forbidden('Only editors and admins edit skip markers');
}

const fixture: MarkersAdminService = {
  async get(actor, videoId) {
    need(actor);
    const durationMs = fixtureDuration(videoId);
    return { ...(held().get(videoId) ?? { markers: [], chapters: [] }), durationMs };
  },
  async siblings() {
    return [];
  },
  async save(actor, videoId, payload) {
    need(actor);
    const durationMs = fixtureDuration(videoId);
    const errors: Record<string, string[]> = {};
    let markers: MarkerInput[] = [];
    let chapters: ChapterInput[] = [];
    for (const run of [
      () => void (markers = validateMarkers(payload.markers, durationMs)),
      () => void (chapters = validateChapters(payload.chapters, durationMs)),
    ]) {
      try {
        run();
      } catch (error) {
        if (!(error instanceof ValidationFailed)) throw error;
        Object.assign(errors, error.fields);
      }
    }
    if (Object.keys(errors).length > 0) throw new ValidationFailed(errors);
    held().set(videoId, { markers, chapters });
  },
};

/** Real data uses the database service. Fixture data keeps a copy in memory so the editor works without one. */
export const markersAdmin: MarkersAdminService = {
  async get(actor, videoId) {
    if (adminDataMode() !== 'real') return fixture.get(actor, videoId);
    return (await import('./real/markers')).realMarkers.get(actor, videoId);
  },
  async siblings(actor, videoId) {
    if (adminDataMode() !== 'real') return fixture.siblings(actor, videoId);
    return (await import('./real/markers')).realMarkers.siblings(actor, videoId);
  },
  async save(actor, videoId, payload) {
    if (adminDataMode() !== 'real') return fixture.save(actor, videoId, payload);
    return (await import('./real/markers')).realMarkers.save(actor, videoId, payload);
  },
};
