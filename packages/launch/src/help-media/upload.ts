import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { StorageAdapter } from '@ad/storage';

export interface HelpUploadItem {
  file: string;
  key: string;
  bytes: number;
  contentType: string;
}

/** The file names the help player asks for (apps/web/src/server/help/video.ts). Anything else is left out. */
const NAME = /^(V[SDWCMKTR]\d{2})-(?:720\.mp4|480\.mp4|phone-720\.mp4|poster\.webp|captions\.vtt)$/;

const TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webp: 'image/webp',
  vtt: 'text/vtt; charset=utf-8',
};

/** Lists the files under `<root>/help/<release>/<VIDEO_ID>/` as storage keys `help/<release>/<VIDEO_ID>/<file>`. */
export async function planHelpUpload(root: string, release: string): Promise<HelpUploadItem[]> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/.test(release))
    throw new Error('The release must be a plain tag such as v1');
  const base = join(root, 'help', release);
  let ids: string[];
  try {
    ids = await readdir(base);
  } catch {
    throw new Error(`No folder help/${release} under ${root}`);
  }
  const items: HelpUploadItem[] = [];
  for (const id of ids.sort()) {
    let names: string[];
    try {
      names = await readdir(join(base, id));
    } catch {
      continue;
    }
    for (const name of names.sort()) {
      const m = NAME.exec(name);
      if (!m || m[1] !== id) continue;
      const file = join(base, id, name);
      items.push({
        file,
        key: `help/${release}/${id}/${name}`,
        bytes: (await stat(file)).size,
        contentType: TYPES[name.slice(name.lastIndexOf('.') + 1)]!,
      });
    }
  }
  return items;
}

/** Uploads a release folder to the private originals bucket. Safe to run again: same size objects are skipped. */
export async function uploadHelpRelease(o: {
  root: string;
  release: string;
  storage: StorageAdapter;
  dryRun?: boolean;
  onFile?: (item: HelpUploadItem, state: 'uploaded' | 'skipped') => void;
}): Promise<{ uploaded: number; skipped: number }> {
  const plan = await planHelpUpload(o.root, o.release);
  if (plan.length === 0) throw new Error(`No help video files found in help/${o.release}`);
  let uploaded = 0;
  let skipped = 0;
  for (const item of plan) {
    const have = await o.storage.head(item.key);
    if (have && have.bytes === item.bytes) {
      skipped++;
      o.onFile?.(item, 'skipped');
      continue;
    }
    if (!o.dryRun) {
      await o.storage.put(item.key, createReadStream(item.file), {
        contentType: item.contentType,
      });
      const after = await o.storage.head(item.key);
      if (after?.bytes !== item.bytes) throw new Error(`Upload check failed for ${item.key}`);
    }
    uploaded++;
    o.onFile?.(item, 'uploaded');
  }
  return { uploaded, skipped };
}
