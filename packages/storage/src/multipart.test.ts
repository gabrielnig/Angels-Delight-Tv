import { describe, expect, it } from 'vitest';
import { MIB, MAX_PARTS, MIN_PART_BYTES, planParts, verifyCompletedParts } from './multipart';

describe('planParts', () => {
  it('splits a file into equal parts with a smaller last part', () => {
    const plan = planParts(20 * MIB, 8 * MIB);
    expect(plan.totalParts).toBe(3);
    expect(plan.parts).toEqual([
      { partNumber: 1, offset: 0, sizeBytes: 8 * MIB },
      { partNumber: 2, offset: 8 * MIB, sizeBytes: 8 * MIB },
      { partNumber: 3, offset: 16 * MIB, sizeBytes: 4 * MIB },
    ]);
  });

  it('uses a single part when the file is smaller than the part size', () => {
    const plan = planParts(3 * MIB, 8 * MIB);
    expect(plan.totalParts).toBe(1);
    expect(plan.parts[0]).toEqual({ partNumber: 1, offset: 0, sizeBytes: 3 * MIB });
  });

  it('has no short last part when the size divides evenly', () => {
    const plan = planParts(16 * MIB, 8 * MIB);
    expect(plan.parts.map((part) => part.sizeBytes)).toEqual([8 * MIB, 8 * MIB]);
  });

  it('rejects a part size below the S3 minimum', () => {
    expect(() => planParts(20 * MIB, MIN_PART_BYTES - 1)).toThrow(/part size/i);
  });

  it('rejects a plan that needs more than 10000 parts', () => {
    expect(() => planParts(MAX_PARTS * 5 * MIB + 1, 5 * MIB)).toThrow(/10000 parts/);
  });

  it('rejects an empty file', () => {
    expect(() => planParts(0, 8 * MIB)).toThrow(/size/i);
  });
});

describe('verifyCompletedParts', () => {
  const plan = planParts(20 * MIB, 8 * MIB);

  it('accepts parts that match the plan', () => {
    const uploaded = plan.parts.map((part) => ({
      partNumber: part.partNumber,
      etag: `"e${part.partNumber}"`,
      sizeBytes: part.sizeBytes,
    }));
    expect(verifyCompletedParts(plan, uploaded)).toEqual({ ok: true });
  });

  it('reports missing part numbers so the client can resume them', () => {
    const uploaded = [{ partNumber: 1, etag: '"e1"', sizeBytes: 8 * MIB }];
    expect(verifyCompletedParts(plan, uploaded)).toEqual({
      ok: false,
      missing: [2, 3],
      mismatched: [],
    });
  });

  it('reports a part whose size differs from the plan', () => {
    const uploaded = plan.parts.map((part) => ({
      partNumber: part.partNumber,
      etag: `"e${part.partNumber}"`,
      sizeBytes: part.partNumber === 2 ? 7 * MIB : part.sizeBytes,
    }));
    expect(verifyCompletedParts(plan, uploaded)).toEqual({
      ok: false,
      missing: [],
      mismatched: [2],
    });
  });
});
