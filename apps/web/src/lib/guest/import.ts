import { clearGuestProgress, listGuestProgress, type GuestStore } from './progress-store';

export interface ImportRequest {
  profileId: string;
  items: Array<{ videoId: string; positionMs: number; finished: boolean; updatedAt: number }>;
}

/** The device history in the shape the server takes: milliseconds, newest first. */
export function buildImportItems(store: GuestStore | null): ImportRequest['items'] {
  return listGuestProgress(store).map((item) => ({
    videoId: item.videoId,
    positionMs: Math.round(item.p * 1000),
    finished: item.f,
    updatedAt: item.t,
  }));
}

/**
 * Moves the device history into a profile. The device copy is removed only after the server accepted it, so a
 * refusal or a lost connection leaves everything where it was (M40-S17).
 */
export async function runImport(input: {
  store: GuestStore | null;
  profileId: string;
  post: (request: ImportRequest) => Promise<{ ok: boolean; imported?: number }>;
}): Promise<{ ok: true; imported: number } | { ok: false }> {
  const items = buildImportItems(input.store);
  if (items.length === 0) return { ok: true, imported: 0 };
  try {
    const result = await input.post({ profileId: input.profileId, items });
    if (!result.ok) return { ok: false };
    clearGuestProgress(input.store);
    return { ok: true, imported: result.imported ?? 0 };
  } catch {
    return { ok: false };
  }
}
