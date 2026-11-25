import { describe, expect, it } from 'vitest';
import { exitCodeFor } from './exit-code';
import { CheckFailed } from './pipeline';
import { CaptureRefused } from './scan-page';
import { StepFailure } from './runner';

describe('exitCodeFor', () => {
  it('1 for a content failure: a step, a check or a capture with real looking data', () => {
    expect(exitCodeFor(new StepFailure('D02', 3, 'Click.', new Error('x')))).toBe(1);
    expect(exitCodeFor(new CheckFailed('D02', 'desktop', ['too long']))).toBe(1);
    expect(exitCodeFor(new CaptureRefused('step 2', []))).toBe(1);
  });
  it('2 for anything else, reported as infrastructure', () => {
    expect(exitCodeFor(new Error('connect ECONNREFUSED'))).toBe(2);
    expect(exitCodeFor('boom')).toBe(2);
  });
});
