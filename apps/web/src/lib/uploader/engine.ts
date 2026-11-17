import { TransportError } from './types';
import type {
  Lane,
  LaneStatus,
  NetworkSource,
  UploadSource,
  UploaderOptions,
  UploadTransport,
} from './types';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const SPEED_WINDOW_MS = 5000;

export const DEFAULT_EXTENSIONS = ['mp4', 'mov', 'mkv'] as const;
export const DEFAULT_MAX_FILE_BYTES = 5 * GIB;

export function laneFingerprint(file: UploadSource): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatLimit(bytes: number): string {
  return bytes >= GIB ? `${+(bytes / GIB).toFixed(1)} GB` : `${Math.round(bytes / MIB)} MB`;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

interface Record_ {
  lane: Lane;
  file: UploadSource;
  running?: Promise<void>;
  controller?: AbortController;
  intent?: 'paused' | 'cancelled';
  completedParts: Set<number>;
  partSize: number;
  inFlight: Map<number, number>;
  completedBytes: number;
  samples: Array<{ t: number; bytes: number }>;
}

export function createUploader(options: UploaderOptions) {
  const transport: UploadTransport = options.transport;
  const fileConcurrency = options.fileConcurrency ?? 2;
  const partConcurrency = options.partConcurrency ?? 3;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const extensions = (options.allowedExtensions ?? DEFAULT_EXTENSIONS).map((e) => e.toLowerCase());
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const network: NetworkSource | undefined = options.network;
  const store = options.store;

  const records: Record_[] = [];
  const listeners = new Set<(lanes: Lane[]) => void>();
  let counter = 0;

  const snapshot = () => records.map((record) => ({ ...record.lane }));
  const notify = () => {
    const lanes = snapshot();
    listeners.forEach((listener) => listener(lanes));
  };
  const find = (id: string) => records.find((record) => record.lane.id === id);
  const setStatus = (record: Record_, status: LaneStatus) => {
    if (record.lane.status === status) return;
    record.lane.status = status;
    notify();
  };

  function refresh(record: Record_, sample = true) {
    const { lane } = record;
    let sent = record.completedBytes;
    for (const bytes of record.inFlight.values()) sent += bytes;
    sent = Math.min(sent, lane.size);
    lane.bytesUploaded = sent;
    const done = lane.status === 'done';
    lane.percent = done ? 100 : Math.min(99, Math.floor((sent / lane.size) * 100));
    if (sample && !done) {
      const t = now();
      record.samples.push({ t, bytes: sent });
      while (record.samples.length > 2 && t - record.samples[0]!.t > SPEED_WINDOW_MS) {
        record.samples.shift();
      }
      const first = record.samples[0]!;
      const seconds = (t - first.t) / 1000;
      lane.speedBytesPerSecond = seconds > 0 ? (sent - first.bytes) / seconds : 0;
      lane.etaSeconds =
        lane.speedBytesPerSecond > 0
          ? Math.ceil((lane.size - sent) / lane.speedBytesPerSecond)
          : null;
    }
    notify();
  }

  function fail(record: Record_, message: string) {
    record.lane.message = message;
    record.lane.speedBytesPerSecond = 0;
    record.lane.etaSeconds = null;
    record.lane.savedPercent = Math.floor((record.completedBytes / record.lane.size) * 100);
    setStatus(record, 'failed');
  }

  function waitOnline(record: Record_, signal: AbortSignal): Promise<void> {
    if (!network || network.isOnline()) return Promise.resolve();
    setStatus(record, 'offline');
    return new Promise<void>((resolve) => {
      let off = () => {};
      const finish = () => {
        off();
        signal.removeEventListener('abort', finish);
        resolve();
      };
      off = network.subscribe((online) => online && finish());
      signal.addEventListener('abort', finish);
    }).then(() => {
      if (!signal.aborted && record.lane.status === 'offline') setStatus(record, 'uploading');
    });
  }

  async function sendPart(record: Record_, partNumber: number, signal: AbortSignal) {
    const { lane, file } = record;
    const offset = (partNumber - 1) * record.partSize;
    const size = Math.min(record.partSize, lane.size - offset);
    let attempt = 0;
    for (;;) {
      await waitOnline(record, signal);
      if (signal.aborted) return false;
      attempt++;
      lane.attempt = attempt;
      try {
        record.inFlight.set(partNumber, 0);
        await transport.uploadPart({
          uploadId: lane.uploadId!,
          partNumber,
          blob: file.slice(offset, offset + size),
          signal,
          onProgress: (sent) => {
            record.inFlight.set(partNumber, Math.min(sent, size));
            refresh(record);
          },
        });
        record.inFlight.delete(partNumber);
        record.completedParts.add(partNumber);
        record.completedBytes += size;
        refresh(record);
        return true;
      } catch (error) {
        record.inFlight.delete(partNumber);
        if (signal.aborted) return false;
        const kind = error instanceof TransportError ? error.kind : 'server';
        if (kind === 'rejected') return false;
        if (kind === 'network' && network && !network.isOnline()) {
          attempt--;
          continue;
        }
        if (attempt >= maxAttempts) return false;
        refresh(record, false);
        await sleep(Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)), signal);
      }
    }
  }

  async function execute(record: Record_) {
    const { lane } = record;
    const controller = new AbortController();
    record.controller = controller;
    const { signal } = controller;
    setStatus(record, 'uploading');
    lane.message = undefined;
    lane.savedPercent = undefined;
    record.samples = [];

    let started;
    try {
      started = await transport.start({
        fingerprint: lane.fingerprint,
        name: lane.name,
        size: lane.size,
        type: lane.type,
        resumeUploadId: lane.uploadId ?? store?.get(lane.fingerprint),
      });
    } catch {
      if (!signal.aborted) fail(record, 'Upload failed before it began. Try again.');
      return;
    }
    if (signal.aborted) return;

    lane.uploadId = started.uploadId;
    store?.set(lane.fingerprint, started.uploadId);
    record.partSize = started.partSizeBytes;
    record.completedParts = new Set(started.uploadedParts);
    record.completedBytes = 0;
    for (const part of record.completedParts) {
      const offset = (part - 1) * record.partSize;
      record.completedBytes += Math.min(record.partSize, lane.size - offset);
    }
    record.inFlight.clear();
    refresh(record);

    const pending: number[] = [];
    for (let part = 1; part <= started.totalParts; part++) {
      if (!record.completedParts.has(part)) pending.push(part);
    }

    let partFailed = false;
    const worker = async () => {
      while (!partFailed && !signal.aborted) {
        const part = pending.shift();
        if (part === undefined) return;
        if (!(await sendPart(record, part, signal))) {
          if (!signal.aborted) partFailed = true;
          return;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(partConcurrency, pending.length) }, worker));
    if (signal.aborted) return;
    if (partFailed) {
      fail(record, `Upload failed. ${Math.floor((record.completedBytes / lane.size) * 100)} percent was saved.`);
      return;
    }

    setStatus(record, 'processing');
    try {
      await transport.complete(lane.uploadId);
    } catch {
      if (!signal.aborted) {
        fail(record, 'Upload failed at the last step. Everything was saved, so Retry only finishes it.');
      }
      return;
    }
    if (signal.aborted) return;
    store?.delete(lane.fingerprint);
    lane.status = 'done';
    lane.completedAt = now();
    lane.speedBytesPerSecond = 0;
    lane.etaSeconds = null;
    refresh(record, false);
  }

  function pump() {
    let active = records.filter((record) => record.running).length;
    for (const record of records) {
      if (active >= fileConcurrency) break;
      if (record.lane.status !== 'waiting' || record.running) continue;
      active++;
      record.running = execute(record)
        .catch(() => fail(record, 'Upload failed. Try again.'))
        .finally(() => {
          record.running = undefined;
          record.intent = record.intent === 'cancelled' ? 'cancelled' : undefined;
          pump();
          notify();
        });
    }
  }

  function reject(file: UploadSource, message: string): Lane {
    const lane = newLane(file);
    lane.status = 'rejected';
    lane.message = message;
    records.push(newRecord(lane, file));
    notify();
    return { ...lane };
  }

  const newLane = (file: UploadSource): Lane => ({
    id: `lane_${++counter}`,
    name: file.name,
    size: file.size,
    type: file.type,
    fingerprint: laneFingerprint(file),
    status: 'waiting',
    bytesUploaded: 0,
    percent: 0,
    speedBytesPerSecond: 0,
    etaSeconds: null,
    attempt: 0,
  });
  const newRecord = (lane: Lane, file: UploadSource): Record_ => ({
    lane,
    file,
    completedParts: new Set(),
    partSize: 0,
    inFlight: new Map(),
    completedBytes: 0,
    samples: [],
  });

  return {
    add(file: UploadSource): Lane {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!extensions.includes(extension)) {
        return reject(file, `${file.name} is not supported. Use MP4, MOV or MKV.`);
      }
      if (file.size <= 0) return reject(file, `${file.name} is empty.`);
      if (file.size > maxFileBytes) {
        return reject(file, `${file.name} is too large. The limit is ${formatLimit(maxFileBytes)}.`);
      }
      const fingerprint = laneFingerprint(file);
      if (records.some((r) => r.lane.fingerprint === fingerprint && r.lane.status !== 'rejected')) {
        return reject(file, `${file.name} is already in the queue.`);
      }
      const lane = newLane(file);
      records.push(newRecord(lane, file));
      notify();
      pump();
      return { ...lane };
    },
    getLanes: snapshot,
    subscribe(listener: (lanes: Lane[]) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    pause(id: string) {
      const record = find(id);
      if (!record) return;
      if (!['waiting', 'uploading', 'offline'].includes(record.lane.status)) return;
      record.intent = 'paused';
      record.controller?.abort();
      record.lane.speedBytesPerSecond = 0;
      record.lane.etaSeconds = null;
      setStatus(record, 'paused');
    },
    resume(id: string) {
      const record = find(id);
      if (!record || record.lane.status !== 'paused') return;
      record.intent = undefined;
      setStatus(record, 'waiting');
      pump();
    },
    retry(id: string) {
      const record = find(id);
      if (!record || !['failed', 'offline'].includes(record.lane.status)) return;
      record.lane.message = undefined;
      setStatus(record, 'waiting');
      pump();
    },
    cancel(id: string) {
      const record = find(id);
      if (!record) return;
      record.intent = 'cancelled';
      record.controller?.abort();
      const { uploadId, fingerprint } = record.lane;
      records.splice(records.indexOf(record), 1);
      store?.delete(fingerprint);
      if (uploadId && record.lane.status !== 'done') void transport.abort(uploadId).catch(() => {});
      notify();
      pump();
    },
    remove(id: string) {
      const record = find(id);
      if (!record || ['uploading', 'processing'].includes(record.lane.status)) return;
      records.splice(records.indexOf(record), 1);
      notify();
    },
    /** True while any lane is waiting or has work in flight. */
    hasActiveWork: () =>
      records.some((r) => r.running || r.lane.status === 'waiting'),
    /** Resolves once nothing is waiting or running. Paused and failed lanes do not count. */
    async idle(): Promise<void> {
      for (;;) {
        const busy = records.filter((r) => r.running);
        if (busy.length === 0 && !records.some((r) => r.lane.status === 'waiting')) return;
        await Promise.race(busy.map((r) => r.running!));
        await Promise.resolve();
        if (busy.length === 0) return;
      }
    },
    /** Resolves when the predicate holds, checked now and after every change. */
    settle(predicate: () => boolean): Promise<void> {
      return new Promise((resolve) => {
        if (predicate()) return resolve();
        const off = this.subscribe(() => {
          if (predicate()) {
            off();
            resolve();
          }
        });
      });
    },
  };
}

export type Uploader = ReturnType<typeof createUploader>;
