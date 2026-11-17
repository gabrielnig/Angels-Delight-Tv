export type FailureCode =
  | 'unreadable_file'
  | 'damaged_file'
  | 'no_video_stream'
  | 'too_long'
  | 'bad_dimensions'
  | 'unsupported_format'
  | 'upload_incomplete'
  | 'out_of_disk'
  | 'storage_unavailable'
  | 'encode_failed'
  | 'key_failed'
  | 'caption_failed'
  | 'caption_service_unavailable'
  | 'script_mismatch'
  | 'timeout'
  | 'unknown';

export interface FailureInfo {
  plain: string;
  permanent: boolean;
}

/** Plain words for admins (M14-S06). Technical detail travels separately and is never shown by default. */
const FAILURES: Record<FailureCode, FailureInfo> = {
  unreadable_file: { plain: 'Could not read this file.', permanent: true },
  damaged_file: { plain: 'The video file is damaged. Try exporting it again.', permanent: true },
  no_video_stream: {
    plain: 'This file has no video in it. Choose a different file.',
    permanent: true,
  },
  too_long: {
    plain: 'This video is longer than the limit. Shorten it or split it.',
    permanent: true,
  },
  bad_dimensions: { plain: 'The picture size of this video is not supported.', permanent: true },
  unsupported_format: {
    plain: 'This type of file is not supported. Use MP4, MOV, MKV or WebM.',
    permanent: true,
  },
  upload_incomplete: {
    plain: 'The upload did not finish. Upload the file again.',
    permanent: true,
  },
  out_of_disk: {
    plain: 'The encoding server is short of space. It will try again later.',
    permanent: false,
  },
  storage_unavailable: {
    plain: 'The file storage could not be reached. It will try again.',
    permanent: false,
  },
  encode_failed: {
    plain: 'The video could not be converted. Try exporting it again.',
    permanent: false,
  },
  key_failed: {
    plain: 'The protection key could not be created. It will try again.',
    permanent: false,
  },
  caption_failed: { plain: 'Captions could not be generated. Try again.', permanent: false },
  caption_service_unavailable: {
    plain: 'The captions service is not responding. It will try again.',
    permanent: false,
  },
  script_mismatch: { plain: 'The script does not match the audio.', permanent: true },
  timeout: { plain: 'This took too long and was stopped. It will try again.', permanent: false },
  unknown: { plain: 'Something went wrong. It will try again.', permanent: false },
};

export function describeFailure(code: FailureCode): FailureInfo {
  return FAILURES[code];
}

export class PipelineError extends Error {
  readonly permanent: boolean;
  readonly plain: string;

  constructor(
    readonly code: FailureCode,
    /** For the developer. Stored, never shown to admins by default. */
    readonly technical: string,
    permanentOverride?: boolean,
  ) {
    super(technical);
    this.name = 'PipelineError';
    this.permanent = permanentOverride ?? FAILURES[code].permanent;
    this.plain = FAILURES[code].plain;
  }
}

const NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

/** Classifies anything thrown inside a job so the mirror row and the retry decision are consistent. */
export function toPipelineError(error: unknown): PipelineError {
  if (error instanceof PipelineError) return error;
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  const text = error instanceof Error ? error.message : String(error);
  if (code === 'ENOSPC') return new PipelineError('out_of_disk', text);
  if (code && NETWORK_CODES.has(code)) return new PipelineError('storage_unavailable', text);
  return new PipelineError('unknown', text);
}
