import { describe, expect, it } from 'vitest';
import { PipelineError, describeFailure, toPipelineError } from './failure';

describe('describeFailure', () => {
  it('gives a plain sentence an admin can act on, with no jargon or stack', () => {
    expect(describeFailure('damaged_file').plain).toBe(
      'The video file is damaged. Try exporting it again.',
    );
    expect(describeFailure('unreadable_file').plain).toBe('Could not read this file.');
  });
  it('marks bad input as permanent and infrastructure trouble as retryable', () => {
    expect(describeFailure('no_video_stream').permanent).toBe(true);
    expect(describeFailure('storage_unavailable').permanent).toBe(false);
    expect(describeFailure('out_of_disk').permanent).toBe(false);
  });
});

describe('toPipelineError', () => {
  it('keeps PipelineError as is', () => {
    const error = new PipelineError('too_long', 'ffprobe said 9999s');
    expect(toPipelineError(error)).toBe(error);
  });
  it('maps ENOSPC to out_of_disk and network errors to storage_unavailable', () => {
    const disk = Object.assign(new Error('write failed'), { code: 'ENOSPC' });
    expect(toPipelineError(disk).code).toBe('out_of_disk');
    const net = Object.assign(new Error('connect'), { code: 'ECONNRESET' });
    expect(toPipelineError(net).code).toBe('storage_unavailable');
  });
  it('wraps unknown errors as retryable with the technical text kept apart', () => {
    const wrapped = toPipelineError(new Error('boom'));
    expect(wrapped.code).toBe('unknown');
    expect(wrapped.permanent).toBe(false);
    expect(wrapped.technical).toBe('boom');
    expect(wrapped.plain).not.toContain('boom');
  });
});
