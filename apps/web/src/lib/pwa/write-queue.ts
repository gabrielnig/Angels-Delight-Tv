export const MAX_QUEUE = 100;
const STORAGE_KEY = 'ad.writequeue.v1';

export interface QueuedWrite {
  profileId: string;
  /** Identifies the item, for example `progress:<videoId>` or `list:<videoId>`. Only the latest write per key is kept. */
  key: string;
  url: string;
  method: 'PUT' | 'POST' | 'DELETE';
  body: unknown;
}

export interface QueueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface FlushResult {
  sent: number;
  dropped: number;
  stoppedOffline: boolean;
}

/** Offline writes for My List and progress (M25-S05). A sender returns the HTTP status or throws when offline. */
export function createWriteQueue(store: QueueStore) {
  const load = (): QueuedWrite[] => {
    try {
      const value = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]') as unknown;
      return Array.isArray(value) ? (value as QueuedWrite[]) : [];
    } catch {
      return [];
    }
  };
  const save = (items: QueuedWrite[]) => {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or blocked: the queue lives only until the page closes.
    }
  };

  return {
    add(item: QueuedWrite): void {
      const rest = load().filter((q) => !(q.profileId === item.profileId && q.key === item.key));
      save([...rest, item].slice(-MAX_QUEUE));
    },
    pending(profileId: string): QueuedWrite[] {
      return load().filter((q) => q.profileId === profileId);
    },
    async flush(
      profileId: string,
      send: (item: QueuedWrite) => Promise<number>,
    ): Promise<FlushResult> {
      const result: FlushResult = { sent: 0, dropped: 0, stoppedOffline: false };
      for (const item of this.pending(profileId)) {
        let status: number;
        try {
          status = await send(item);
        } catch {
          result.stoppedOffline = true;
          break;
        }
        const remove = () =>
          save(load().filter((q) => !(q.profileId === item.profileId && q.key === item.key)));
        if (status === 401 || status === 403) {
          remove();
          result.dropped += 1;
        } else if (status >= 200 && status < 300) {
          remove();
          result.sent += 1;
        } else if (status >= 400 && status < 500) {
          remove();
          result.dropped += 1;
        } else {
          result.stoppedOffline = true;
          break;
        }
      }
      return result;
    },
  };
}
