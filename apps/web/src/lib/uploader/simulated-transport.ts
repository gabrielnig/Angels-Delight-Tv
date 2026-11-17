import { TransportError } from './types';
import type { PartRequest, StartResult, UploadTransport } from './types';

export interface SimulatedOptions {
  partSizeBytes?: number;
  bytesPerSecond?: number;
  /** Names containing this word keep failing their last part until Retry, to show Retry resuming. */
  flakyWord?: string;
}

/**
 * Timer driven transport for the fixture build, before the upload API lane is wired in.
 * It keeps its own "server" so Retry and reload resume really skip stored parts.
 */
export function createSimulatedTransport(options: SimulatedOptions = {}): UploadTransport {
  const partSize = options.partSizeBytes ?? 8 * 1024 * 1024;
  const speed = options.bytesPerSecond ?? 12 * 1024 * 1024;
  const flaky = options.flakyWord ?? 'flaky';
  const parts = new Map<string, Set<number>>();
  const meta = new Map<string, { name: string; size: number; broken: boolean }>();
  const byFingerprint = new Map<string, string>();
  let counter = 0;

  return {
    async start(input): Promise<StartResult> {
      let uploadId = input.resumeUploadId ?? byFingerprint.get(input.fingerprint);
      if (!uploadId || !parts.has(uploadId)) {
        uploadId = `sim_${++counter}`;
        parts.set(uploadId, new Set());
        meta.set(uploadId, { name: input.name, size: input.size, broken: input.name.toLowerCase().includes(flaky) });
      }
      // A manual Retry (start with a known upload id) is what mends a flaky file.
      if (input.resumeUploadId) meta.get(uploadId)!.broken = false;
      byFingerprint.set(input.fingerprint, uploadId);
      return {
        uploadId,
        partSizeBytes: partSize,
        totalParts: Math.ceil(input.size / partSize),
        uploadedParts: [...parts.get(uploadId)!],
      };
    },

    uploadPart({ uploadId, partNumber, blob, signal, onProgress }: PartRequest) {
      return new Promise<void>((resolve, reject) => {
        const info = meta.get(uploadId)!;
        const total = Math.ceil(info.size / partSize);
        const steps = 6;
        const duration = Math.max(150, (blob.size / speed) * 1000);
        let step = 0;
        const timer = setInterval(() => {
          step++;
          onProgress(Math.floor((blob.size * step) / steps));
          const failHere = info.broken && partNumber === total && total > 1 && step === 3;
          if (failHere) {
            clearInterval(timer);
            reject(new TransportError('Connection dropped', 'server'));
          } else if (step >= steps) {
            clearInterval(timer);
            parts.get(uploadId)?.add(partNumber);
            resolve();
          }
        }, duration / steps);
        signal.addEventListener('abort', () => {
          clearInterval(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    },

    async complete() {},
    async abort(uploadId) {
      parts.delete(uploadId);
    },
  };
}
