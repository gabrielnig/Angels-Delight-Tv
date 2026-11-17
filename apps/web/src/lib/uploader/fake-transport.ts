import { TransportError } from './types';
import type { PartRequest, StartResult, UploadSource, UploadTransport } from './types';

export function fakeFile(name: string, size: number, lastModified = 1): UploadSource {
  return {
    name,
    size,
    type: 'video/mp4',
    lastModified,
    slice: (start, end) => new Blob([new Uint8Array(Math.max(0, Math.min(end, size) - start))]),
  };
}

export interface FakePartCall {
  uploadId: string;
  name: string;
  partNumber: number;
  size: number;
  ok: boolean;
}

export interface FakeTransportOptions {
  partSizeBytes?: number;
  /** Hold every part until the test releases it. */
  gated?: boolean;
  failPart?: (call: FakePartCall) => boolean;
  failWith?: (call: FakePartCall) => Error;
  failStart?: (name: string) => boolean;
  failComplete?: () => boolean;
}

interface Gate {
  call: FakePartCall;
  request: PartRequest;
  release: () => void;
}

/**
 * In memory stand in for the admin upload API. Keeps "server truth" (parts held per upload) so
 * resume behaves like ListParts. Used by the engine tests and by the fixture upload screen.
 */
export function createFakeTransport(options: FakeTransportOptions = {}) {
  const partSizeBytes = options.partSizeBytes ?? 8 * 1024 * 1024;
  const serverParts = new Map<string, Set<number>>();
  const uploadsByFingerprint = new Map<string, string>();
  const names = new Map<string, string>();
  const sizes = new Map<string, number>();
  const gates: Gate[] = [];
  let counter = 0;
  let inFlight = 0;

  const self = {
    partCalls: [] as FakePartCall[],
    started: [] as Array<Parameters<UploadTransport['start']>[0]>,
    completed: [] as string[],
    aborted: [] as string[],
    maxInFlight: 0,
    autoRelease: !options.gated,
    failPart: options.failPart ?? (() => false),
    failWith: options.failWith ?? (() => new TransportError('Part failed', 'server')),
    failStart: options.failStart ?? (() => false),
    failComplete: options.failComplete ?? (() => false),
    onBeforePart: undefined as undefined | ((call: FakePartCall) => void),

    async start(input: Parameters<UploadTransport['start']>[0]): Promise<StartResult> {
      self.started.push(input);
      if (self.failStart(input.name)) throw new TransportError('Could not start', 'server');
      let uploadId = input.resumeUploadId ?? uploadsByFingerprint.get(input.fingerprint);
      if (!uploadId || !serverParts.has(uploadId)) {
        uploadId = `up_${++counter}`;
        serverParts.set(uploadId, new Set());
        names.set(uploadId, input.name);
        sizes.set(uploadId, input.size);
      }
      uploadsByFingerprint.set(input.fingerprint, uploadId);
      return {
        uploadId,
        partSizeBytes,
        totalParts: Math.ceil(input.size / partSizeBytes),
        uploadedParts: [...serverParts.get(uploadId)!].sort((a, b) => a - b),
      };
    },

    async uploadPart(request: PartRequest): Promise<void> {
      const call: FakePartCall = {
        uploadId: request.uploadId,
        name: names.get(request.uploadId) ?? '',
        partNumber: request.partNumber,
        size: request.blob.size,
        ok: false,
      };
      self.partCalls.push(call);
      inFlight++;
      self.maxInFlight = Math.max(self.maxInFlight, inFlight);
      try {
        self.onBeforePart?.(call);
        if (!self.autoRelease) {
          await new Promise<void>((resolve, reject) => {
            const gate: Gate = { call, request, release: resolve };
            gates.push(gate);
            request.signal.addEventListener('abort', () => {
              gates.splice(gates.indexOf(gate), 1);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        }
        if (request.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (self.failPart(call)) throw self.failWith(call);
        request.onProgress(request.blob.size);
        serverParts.get(request.uploadId)?.add(request.partNumber);
        call.ok = true;
      } finally {
        inFlight--;
      }
    },

    async complete(uploadId: string): Promise<void> {
      if (self.failComplete()) throw new TransportError('Could not finish', 'server');
      self.completed.push(uploadId);
    },

    async abort(uploadId: string): Promise<void> {
      self.aborted.push(uploadId);
      serverParts.delete(uploadId);
    },

    // Test controls
    /** Release every waiting part and let later parts through at once. */
    releaseAll() {
      self.autoRelease = true;
      for (const gate of gates.splice(0)) gate.release();
    },
    releaseOne() {
      gates.shift()?.release();
    },
    /** Send progress for the nth gated part currently waiting. */
    progress(index: number, sentBytes: number) {
      gates[index]?.request.onProgress(sentBytes);
    },
    async untilInFlight(count: number) {
      for (let i = 0; i < 200 && gates.length < count; i++) await Promise.resolve();
      if (gates.length < count) await new Promise((r) => setTimeout(r, 5));
      if (gates.length < count) throw new Error(`Only ${gates.length} parts in flight`);
    },
    async untilCalls(count: number) {
      for (let i = 0; i < 200 && self.partCalls.length < count; i++) await Promise.resolve();
      if (self.partCalls.length < count) await new Promise((r) => setTimeout(r, 5));
      if (self.partCalls.length < count) throw new Error(`Only ${self.partCalls.length} calls`);
    },
    sizeOf: (uploadId: string) => sizes.get(uploadId),
  };
  return self;
}

export type FakeTransport = ReturnType<typeof createFakeTransport>;
