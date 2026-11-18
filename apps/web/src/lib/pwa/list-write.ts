import type { QueuedWrite } from './write-queue';

export type ToggleOutcome = 'sent' | 'queued';

/** The My List request for one change, so it can wait in the offline queue (M10-S01 AC3, M25-S05). */
export function listWrite(profileId: string, itemKey: string, add: boolean): QueuedWrite {
  const [kind, ...rest] = itemKey.split(':');
  const id = rest.join(':');
  return {
    profileId,
    key: `list:${itemKey}`,
    url: '/api/my-list',
    method: add ? 'POST' : 'DELETE',
    body: { profileId, target: { kind: kind === 'series' ? 'series' : 'video', id } },
  };
}

/**
 * Sends a My List change, or queues it when the device is offline or the request cannot reach the server.
 * A refusal from the server is rethrown so the caller can roll the button back.
 */
export async function toggleWithQueue(input: {
  toggle: (itemKey: string, add: boolean) => Promise<void>;
  itemKey: string;
  add: boolean;
  profileId: string | null;
  online: boolean;
  queue: { add(item: QueuedWrite): void };
}): Promise<ToggleOutcome> {
  const { toggle, itemKey, add, profileId, online, queue } = input;
  const enqueue = (): ToggleOutcome => {
    queue.add(listWrite(profileId!, itemKey, add));
    return 'queued';
  };
  if (!online && profileId) return enqueue();
  try {
    await toggle(itemKey, add);
    return 'sent';
  } catch (error) {
    if (error instanceof TypeError && profileId) return enqueue();
    throw error;
  }
}
