import type { PartInfo } from './types';

export const MIB = 1024 * 1024;
export const MIN_PART_BYTES = 5 * MIB;
export const MAX_PARTS = 10_000;

export interface PlannedPart {
  partNumber: number;
  offset: number;
  sizeBytes: number;
}

export interface PartPlan {
  totalParts: number;
  partSizeBytes: number;
  sizeBytes: number;
  parts: PlannedPart[];
}

/** All parts are equal except the last, as S3 requires. */
export function planParts(sizeBytes: number, partSizeBytes: number): PartPlan {
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error('File size must be a positive integer');
  }
  if (partSizeBytes < MIN_PART_BYTES) {
    throw new Error(`Part size must be at least ${MIN_PART_BYTES} bytes`);
  }
  const totalParts = Math.ceil(sizeBytes / partSizeBytes);
  if (totalParts > MAX_PARTS) {
    throw new Error(`Upload would need more than ${MAX_PARTS} parts, raise the part size`);
  }
  const parts: PlannedPart[] = [];
  for (let index = 0; index < totalParts; index++) {
    const offset = index * partSizeBytes;
    parts.push({
      partNumber: index + 1,
      offset,
      sizeBytes: Math.min(partSizeBytes, sizeBytes - offset),
    });
  }
  return { totalParts, partSizeBytes, sizeBytes, parts };
}

export type PartCheck = { ok: true } | { ok: false; missing: number[]; mismatched: number[] };

/** Compares what the bucket reports (ListParts) with the plan before completing an upload. */
export function verifyCompletedParts(plan: PartPlan, uploaded: PartInfo[]): PartCheck {
  const byNumber = new Map(uploaded.map((part) => [part.partNumber, part]));
  const missing: number[] = [];
  const mismatched: number[] = [];
  for (const planned of plan.parts) {
    const part = byNumber.get(planned.partNumber);
    if (!part) missing.push(planned.partNumber);
    else if (part.sizeBytes !== planned.sizeBytes) mismatched.push(planned.partNumber);
  }
  return missing.length === 0 && mismatched.length === 0
    ? { ok: true }
    : { ok: false, missing, mismatched };
}
