/** What the engine needs from a File. A browser File satisfies it. */
export interface UploadSource {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  slice(start: number, end: number): Blob;
}

export interface StartResult {
  uploadId: string;
  partSizeBytes: number;
  totalParts: number;
  /** Parts the server already holds (server truth from ListParts). */
  uploadedParts: number[];
  /** The draft video the server created for this upload, when it says so. */
  videoId?: string;
}

export interface PartRequest {
  uploadId: string;
  partNumber: number;
  blob: Blob;
  signal: AbortSignal;
  /** Bytes of this part sent so far. */
  onProgress: (sentBytes: number) => void;
}

export type TransportErrorKind = 'network' | 'server' | 'rejected';

export class TransportError extends Error {
  constructor(
    message: string,
    readonly kind: TransportErrorKind,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

/** Replaceable seam: the HTTP transport in production, a fake in tests. */
export interface UploadTransport {
  /** Idempotent. Passing a known uploadId resyncs and returns the parts the server already has. */
  start(input: {
    fingerprint: string;
    name: string;
    size: number;
    type: string;
    resumeUploadId?: string;
  }): Promise<StartResult>;
  uploadPart(request: PartRequest): Promise<void>;
  complete(uploadId: string): Promise<void>;
  abort(uploadId: string): Promise<void>;
}

export interface ResumeStore {
  get(fingerprint: string): string | undefined;
  set(fingerprint: string, uploadId: string): void;
  delete(fingerprint: string): void;
}

export interface NetworkSource {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
}

export type LaneStatus =
  'waiting' | 'uploading' | 'paused' | 'offline' | 'processing' | 'done' | 'failed' | 'rejected';

export interface Lane {
  id: string;
  name: string;
  size: number;
  type: string;
  fingerprint: string;
  status: LaneStatus;
  uploadId?: string;
  videoId?: string;
  bytesUploaded: number;
  percent: number;
  speedBytesPerSecond: number;
  etaSeconds: number | null;
  attempt: number;
  /** Plain words for the person, set on failed and rejected lanes. */
  message?: string;
  /** Percent saved on the server when the lane failed. */
  savedPercent?: number;
  completedAt?: number;
}

export interface UploaderOptions {
  transport: UploadTransport;
  /** Files uploading at once. Default 2 (D-006). */
  fileConcurrency?: number;
  /** Parts in flight per file. Default 3 (D-006). */
  partConcurrency?: number;
  maxFileBytes?: number;
  allowedExtensions?: readonly string[];
  /** Automatic attempts per part before the lane fails. Default 4. */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  network?: NetworkSource;
  store?: ResumeStore;
}
