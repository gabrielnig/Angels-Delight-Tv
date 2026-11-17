import { ValidationFailed, base32Random, type RandomSource } from '@ad/shared';

export const ALLOWED_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm'] as const;
export type VideoExtension = (typeof ALLOWED_EXTENSIONS)[number];

const MIME_BY_EXTENSION: Record<VideoExtension, string[]> = {
  mp4: ['video/mp4'],
  mov: ['video/quicktime', 'video/mp4'],
  mkv: ['video/x-matroska', 'video/matroska', 'video/webm'],
  webm: ['video/webm'],
};

/** Browsers often send nothing for mkv and mov. The extension and later the magic bytes decide. */
const GENERIC_MIME = new Set(['', 'application/octet-stream']);

export interface UploadLimits {
  maxBytes: number;
  partBytes: number;
}

export interface UploadRequest {
  name: string;
  size: number;
  type: string;
  fingerprint: string;
}

export interface ValidatedUpload {
  filename: string;
  extension: VideoExtension;
  size: number;
  mime: string;
  fingerprint: string;
}

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

export function formatLimit(bytes: number): string {
  if (bytes >= GIB) return `${Number((bytes / GIB).toFixed(1))} GB`;
  return `${Math.round(bytes / MIB)} MB`;
}

/** The name is for display only and never reaches a storage key (SECURITY section 8). */
export function sanitizeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned.slice(0, 255);
}

const FINGERPRINT = /^[A-Za-z0-9_-]{8,128}$/;

export function validateUploadRequest(input: UploadRequest, limits: UploadLimits): ValidatedUpload {
  const fields: Record<string, string[]> = {};
  const filename = sanitizeFilename(String(input.name ?? ''));
  const extension = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';

  if (!filename || !(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    fields.name = ['This file type is not supported. Use MP4, MOV, MKV or WebM.'];
  }
  if (!Number.isInteger(input.size) || input.size <= 0) {
    fields.size = ['The file looks empty.'];
  } else if (input.size > limits.maxBytes) {
    fields.size = [`This file is larger than the ${formatLimit(limits.maxBytes)} limit.`];
  }
  const mime = String(input.type ?? '').toLowerCase();
  const allowedMime = MIME_BY_EXTENSION[extension as VideoExtension];
  if (allowedMime && !GENERIC_MIME.has(mime) && !allowedMime.includes(mime)) {
    fields.type = ['The file type does not match its name.'];
  }
  if (!FINGERPRINT.test(String(input.fingerprint ?? ''))) {
    fields.fingerprint = ['The file identifier is not valid.'];
  }
  if (Object.keys(fields).length > 0) throw new ValidationFailed(fields);

  return {
    filename,
    extension: extension as VideoExtension,
    size: input.size,
    mime: mime || 'application/octet-stream',
    fingerprint: input.fingerprint,
  };
}

/** M13-S09 edge: underscores become spaces, the extension goes, the result is trimmed. */
export function titleFromFilename(filename: string): string {
  const withoutExtension = filename.trim().replace(/\.[A-Za-z0-9]{1,5}$/, '');
  const title = withoutExtension
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
    .trim();
  return title === '' ? 'Untitled video' : title;
}

/** Matches the videos_slug_format check: lowercase words joined by single hyphens, 3 to 120 characters. */
export function slugFromTitle(title: string, random?: RandomSource): string {
  const words = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
  const suffix = base32Random(4, random);
  return `${words || 'video'}-${suffix}`;
}

const MAX_PARTS = 10_000;

/** Whole MiB parts, as few as allowed, never more than 10,000 of them (S3 limit). */
export function choosePartSize(sizeBytes: number, configuredPartBytes: number): number {
  if (Math.ceil(sizeBytes / configuredPartBytes) <= MAX_PARTS) return configuredPartBytes;
  return Math.ceil(sizeBytes / MAX_PARTS / MIB) * MIB;
}
