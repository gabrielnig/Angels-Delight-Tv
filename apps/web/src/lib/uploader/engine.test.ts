import { describe, expect, it } from 'vitest';
import { createUploader, laneFingerprint } from './engine';
import { createFakeTransport, fakeFile } from './fake-transport';
import { TransportError } from './types';
import type { Lane, NetworkSource } from './types';

const MIB = 1024 * 1024;
const PART = 8 * MIB;

const instantSleep = async () => {};

function make(options: Parameters<typeof createFakeTransport>[0] = {}, extra = {}) {
  const transport = createFakeTransport({ partSizeBytes: PART, ...options });
  const uploader = createUploader({
    transport,
    sleep: instantSleep,
    maxAttempts: 3,
    baseDelayMs: 100,
    ...extra,
  });
  return { transport, uploader };
}

async function settled(uploader: ReturnType<typeof createUploader>) {
  await uploader.idle();
  return uploader.getLanes();
}

const byName = (lanes: Lane[], name: string) => lanes.find((lane) => lane.name === name)!;

describe('uploader engine: happy path', () => {
  it('uploads every part, completes, and reports done at 100 percent', async () => {
    const { transport, uploader } = make();
    uploader.add(fakeFile('lesson.mp4', 20 * MIB));
    const [lane] = await settled(uploader);
    expect(lane!.status).toBe('done');
    expect(lane!.percent).toBe(100);
    expect(lane!.bytesUploaded).toBe(20 * MIB);
    expect(transport.partCalls.map((call) => call.partNumber).sort()).toEqual([1, 2, 3]);
    expect(transport.completed).toEqual([lane!.uploadId]);
  });

  it('sends part sizes that add up to the file size, last part smaller', async () => {
    const { transport, uploader } = make();
    uploader.add(fakeFile('a.mp4', 20 * MIB));
    await settled(uploader);
    const sizes = transport.partCalls
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((c) => c.size);
    expect(sizes).toEqual([PART, PART, 4 * MIB]);
  });

  it('notifies subscribers and stops after unsubscribe', async () => {
    const { uploader } = make();
    const seen: string[] = [];
    const off = uploader.subscribe((lanes) => seen.push(lanes.map((l) => l.status).join()));
    uploader.add(fakeFile('a.mp4', 10 * MIB));
    await settled(uploader);
    expect(seen.length).toBeGreaterThan(1);
    off();
    const count = seen.length;
    uploader.add(fakeFile('b.mp4', 10 * MIB));
    await settled(uploader);
    expect(seen.length).toBe(count);
  });
});

describe('uploader engine: parallelism', () => {
  it('never has more than 3 parts of one file in flight', async () => {
    const { transport, uploader } = make({ gated: true });
    uploader.add(fakeFile('big.mp4', 10 * PART));
    await transport.untilInFlight(3);
    expect(transport.maxInFlight).toBe(3);
    transport.releaseAll();
    await settled(uploader);
    expect(transport.maxInFlight).toBe(3);
  });

  it('runs 2 files at once and keeps the rest waiting', async () => {
    const { transport, uploader } = make({ gated: true });
    for (const name of ['a.mp4', 'b.mp4', 'c.mp4']) uploader.add(fakeFile(name, PART));
    await transport.untilInFlight(2);
    const lanes = uploader.getLanes();
    expect(lanes.map((l) => l.status)).toEqual(['uploading', 'uploading', 'waiting']);
    transport.releaseAll();
    const done = await settled(uploader);
    expect(done.map((l) => l.status)).toEqual(['done', 'done', 'done']);
  });

  it('honours custom concurrency', async () => {
    const { transport, uploader } = make(
      { gated: true },
      { fileConcurrency: 1, partConcurrency: 1 },
    );
    uploader.add(fakeFile('a.mp4', 3 * PART));
    uploader.add(fakeFile('b.mp4', 3 * PART));
    await transport.untilInFlight(1);
    expect(uploader.getLanes().map((l) => l.status)).toEqual(['uploading', 'waiting']);
    transport.releaseAll();
    await settled(uploader);
    expect(transport.maxInFlight).toBe(1);
  });
});

describe('uploader engine: settings', () => {
  it('raising the file concurrency starts waiting lanes at once', async () => {
    const { transport, uploader } = make({ gated: true }, { fileConcurrency: 1 });
    for (const name of ['a.mp4', 'b.mp4', 'c.mp4']) uploader.add(fakeFile(name, PART));
    await transport.untilInFlight(1);
    expect(uploader.getLanes().map((l) => l.status)).toEqual(['uploading', 'waiting', 'waiting']);
    uploader.setFileConcurrency(3);
    await transport.untilInFlight(3);
    expect(uploader.getLanes().map((l) => l.status)).toEqual([
      'uploading',
      'uploading',
      'uploading',
    ]);
    transport.releaseAll();
    await settled(uploader);
  });

  it('keeps the video id the server gave the lane', async () => {
    const { uploader } = make({ videoIdFor: (name) => `vid_${name}` });
    uploader.add(fakeFile('a.mp4', PART));
    const [lane] = await settled(uploader);
    expect(lane!.videoId).toBe('vid_a.mp4');
  });
});

describe('uploader engine: failure isolation', () => {
  it('a failing file does not stop or fail the others', async () => {
    const { uploader } = make({
      failPart: (call) => call.name === 'bad.mp4' && call.partNumber === 2,
      failWith: () => new TransportError('storage said no', 'server'),
    });
    uploader.add(fakeFile('good1.mp4', 3 * PART));
    uploader.add(fakeFile('bad.mp4', 3 * PART));
    uploader.add(fakeFile('good2.mp4', 3 * PART));
    const lanes = await settled(uploader);
    expect(byName(lanes, 'good1.mp4').status).toBe('done');
    expect(byName(lanes, 'good2.mp4').status).toBe('done');
    const bad = byName(lanes, 'bad.mp4');
    expect(bad.status).toBe('failed');
    expect(bad.message).toMatch(/Upload failed/);
  });

  it('a lane that fails frees its slot for the next waiting file', async () => {
    const { uploader } = make(
      { failPart: (call) => call.name === 'bad.mp4' },
      { fileConcurrency: 1 },
    );
    uploader.add(fakeFile('bad.mp4', PART));
    uploader.add(fakeFile('ok.mp4', PART));
    const lanes = await settled(uploader);
    expect(byName(lanes, 'bad.mp4').status).toBe('failed');
    expect(byName(lanes, 'ok.mp4').status).toBe('done');
  });

  it('a start failure fails only that lane', async () => {
    const { uploader } = make({ failStart: (name) => name === 'x.mp4' });
    uploader.add(fakeFile('x.mp4', PART));
    uploader.add(fakeFile('y.mp4', PART));
    const lanes = await settled(uploader);
    expect(byName(lanes, 'x.mp4').status).toBe('failed');
    expect(byName(lanes, 'y.mp4').status).toBe('done');
  });
});

describe('uploader engine: retry and resume', () => {
  it('retries a flaky part with exponential backoff and then succeeds', async () => {
    const delays: number[] = [];
    let failures = 2;
    const { uploader } = make(
      { failPart: (call) => call.partNumber === 1 && failures-- > 0 },
      { sleep: async (ms: number) => void delays.push(ms) },
    );
    uploader.add(fakeFile('a.mp4', PART));
    const [lane] = await settled(uploader);
    expect(lane!.status).toBe('done');
    expect(delays).toEqual([100, 200]);
  });

  it('after automatic attempts run out the lane fails and says how much was saved', async () => {
    const { uploader } = make({ failPart: (call) => call.partNumber === 10 });
    uploader.add(fakeFile('a.mp4', 10 * PART));
    const [lane] = await settled(uploader);
    expect(lane!.status).toBe('failed');
    expect(lane!.savedPercent).toBe(90);
    expect(lane!.message).toBe('Upload failed. 90 percent was saved.');
  });

  it('manual retry resumes from the saved parts and does not resend them', async () => {
    let broken = true;
    const { transport, uploader } = make({ failPart: (call) => broken && call.partNumber === 10 });
    uploader.add(fakeFile('a.mp4', 10 * PART));
    const [failed] = await settled(uploader);
    expect(failed!.status).toBe('failed');
    const sentBefore = transport.partCalls.filter((c) => c.ok).map((c) => c.partNumber);
    expect(sentBefore.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    broken = false;
    transport.partCalls.length = 0;
    uploader.retry(failed!.id);
    const [lane] = await settled(uploader);
    expect(lane!.status).toBe('done');
    expect(transport.partCalls.map((c) => c.partNumber)).toEqual([10]);
    expect(transport.started.at(-1)!.resumeUploadId).toBe(lane!.uploadId);
  });

  it('resumes a file picked again after a reload using the stored upload id', async () => {
    const store = new Map<string, string>();
    const resumeStore = {
      get: (fp: string) => store.get(fp),
      set: (fp: string, id: string) => void store.set(fp, id),
      delete: (fp: string) => void store.delete(fp),
    };
    const file = fakeFile('a.mp4', 3 * PART);
    const first = make({ failPart: (call) => call.partNumber === 3 }, { store: resumeStore });
    first.uploader.add(file);
    await settled(first.uploader);
    expect(store.size).toBe(1);

    const second = createUploader({
      transport: first.transport,
      sleep: instantSleep,
      store: resumeStore,
    });
    first.transport.partCalls.length = 0;
    first.transport.failPart = () => false;
    second.add(file);
    const [lane] = await settled(second);
    expect(lane!.status).toBe('done');
    expect(first.transport.partCalls.map((c) => c.partNumber).sort()).toEqual([3]);
    expect(store.size).toBe(0);
  });

  it('a failed complete step retries complete only', async () => {
    let breakComplete = true;
    const { transport, uploader } = make({ failComplete: () => breakComplete });
    uploader.add(fakeFile('a.mp4', 2 * PART));
    const [failed] = await settled(uploader);
    expect(failed!.status).toBe('failed');
    breakComplete = false;
    transport.partCalls.length = 0;
    uploader.retry(failed!.id);
    const [lane] = await settled(uploader);
    expect(lane!.status).toBe('done');
    expect(transport.partCalls).toHaveLength(0);
  });
});

describe('uploader engine: pause, cancel, remove', () => {
  it('pausing stops sending parts and resuming finishes only what is missing', async () => {
    const { transport, uploader } = make({ gated: true }, { partConcurrency: 1 });
    uploader.add(fakeFile('a.mp4', 4 * PART));
    await transport.untilInFlight(1);
    transport.releaseOne();
    await transport.untilCalls(2);
    const id = uploader.getLanes()[0]!.id;
    uploader.pause(id);
    expect(uploader.getLanes()[0]!.status).toBe('paused');
    const callsAtPause = transport.partCalls.length;
    transport.releaseAll();
    await Promise.resolve();
    expect(transport.partCalls.length).toBe(callsAtPause);
    uploader.resume(id);
    transport.autoRelease = true;
    transport.releaseAll();
    const [lane] = await settled(uploader);
    expect(lane!.status).toBe('done');
    const sent = transport.partCalls.filter((c) => c.ok).map((c) => c.partNumber);
    expect(new Set(sent)).toEqual(new Set([1, 2, 3, 4]));
  });

  it('cancel aborts the server session and removes the lane', async () => {
    const { transport, uploader } = make({ gated: true });
    uploader.add(fakeFile('a.mp4', 2 * PART));
    await transport.untilInFlight(1);
    const lane = uploader.getLanes()[0]!;
    uploader.cancel(lane.id);
    await settled(uploader);
    expect(uploader.getLanes()).toHaveLength(0);
    expect(transport.aborted).toEqual([lane.uploadId]);
  });

  it('remove drops a finished lane without touching others', async () => {
    const { uploader } = make();
    uploader.add(fakeFile('a.mp4', PART));
    uploader.add(fakeFile('b.mp4', PART));
    const lanes = await settled(uploader);
    uploader.remove(lanes[0]!.id);
    expect(uploader.getLanes().map((l) => l.name)).toEqual(['b.mp4']);
  });
});

describe('uploader engine: validation', () => {
  it('rejects unsupported types with a plain message and never touches the transport', async () => {
    const { transport, uploader } = make();
    uploader.add(fakeFile('movie.avi', PART));
    const [lane] = uploader.getLanes();
    expect(lane!.status).toBe('rejected');
    expect(lane!.message).toBe('movie.avi is not supported. Use MP4, MOV or MKV.');
    await settled(uploader);
    expect(transport.started).toHaveLength(0);
  });

  it('rejects files over the size limit and empty files', async () => {
    const { uploader } = make({}, { maxFileBytes: 10 * MIB });
    uploader.add(fakeFile('huge.mp4', 11 * MIB));
    uploader.add(fakeFile('empty.mp4', 0));
    const lanes = uploader.getLanes();
    expect(lanes[0]!.message).toBe('huge.mp4 is too large. The limit is 10 MB.');
    expect(lanes[1]!.message).toBe('empty.mp4 is empty.');
    expect(lanes.every((l) => l.status === 'rejected')).toBe(true);
  });

  it('accepts mp4, mov and mkv in any case', async () => {
    const { uploader } = make();
    for (const name of ['a.MP4', 'b.mov', 'c.MKV']) uploader.add(fakeFile(name, PART));
    const lanes = await settled(uploader);
    expect(lanes.every((l) => l.status === 'done')).toBe(true);
  });

  it('rejects an add of the same file already in the queue', () => {
    const { uploader } = make({ gated: true });
    const file = fakeFile('a.mp4', PART);
    uploader.add(file);
    const second = uploader.add(file);
    expect(second.status).toBe('rejected');
    expect(second.message).toBe('a.mp4 is already in the queue.');
  });
});

describe('uploader engine: offline', () => {
  function network(initial = true) {
    let online = initial;
    const listeners = new Set<(online: boolean) => void>();
    const source: NetworkSource = {
      isOnline: () => online,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    return {
      source,
      set(value: boolean) {
        online = value;
        listeners.forEach((l) => l(value));
      },
    };
  }

  it('waits for the network instead of failing, then resumes by itself', async () => {
    const net = network(true);
    const { transport, uploader } = make(
      {
        failPart: (call) => !net.source.isOnline() && call.partNumber === 2,
        failWith: () => new TransportError('offline', 'network'),
      },
      { network: net.source },
    );
    let dropped = false;
    transport.onBeforePart = (call) => {
      if (call.partNumber === 2 && !dropped) {
        dropped = true;
        net.set(false);
      }
    };
    uploader.add(fakeFile('a.mp4', 3 * PART));
    await uploader.settle(() => uploader.getLanes()[0]!.status === 'offline');
    expect(uploader.getLanes()[0]!.status).toBe('offline');
    net.set(true);
    const [lane] = await settled(uploader);
    expect(lane!.status).toBe('done');
  });
});

describe('uploader engine: speed and eta', () => {
  it('reports speed and time left from recent progress', async () => {
    let clock = 0;
    const { transport, uploader } = make({ gated: true }, { now: () => clock, partConcurrency: 1 });
    uploader.add(fakeFile('a.mp4', 4 * PART));
    await transport.untilInFlight(1);
    clock = 1000;
    transport.progress(0, 4 * MIB);
    clock = 2000;
    transport.progress(0, 8 * MIB);
    const [lane] = uploader.getLanes();
    expect(lane!.speedBytesPerSecond).toBe(4 * MIB);
    expect(lane!.etaSeconds).toBe(6);
    expect(lane!.percent).toBe(25);
    transport.autoRelease = true;
    transport.releaseAll();
    await settled(uploader);
  });

  it('has no eta before there is a speed', () => {
    const { uploader } = make({ gated: true });
    uploader.add(fakeFile('a.mp4', PART));
    expect(uploader.getLanes()[0]!.etaSeconds).toBeNull();
  });
});

describe('laneFingerprint', () => {
  it('combines name, size and modified time', () => {
    expect(laneFingerprint(fakeFile('a.mp4', 5, 123))).toBe('a.mp4:5:123');
  });
});

describe('uploader engine: replacing the file of a video', () => {
  const VIDEO = '0192f0a0-0000-7000-8000-0000000000aa';

  it('tells the server which video the upload replaces', async () => {
    const { transport, uploader } = make();
    uploader.add(fakeFile('fixed.mp4', 10 * MIB), { replaceVideoId: VIDEO });
    await settled(uploader);
    expect(transport.started[0]).toMatchObject({ replaceVideoId: VIDEO });
  });

  it('sends nothing extra for a normal upload', async () => {
    const { transport, uploader } = make();
    uploader.add(fakeFile('new.mp4', 10 * MIB));
    await settled(uploader);
    expect(transport.started[0]!.replaceVideoId).toBeUndefined();
  });
});
