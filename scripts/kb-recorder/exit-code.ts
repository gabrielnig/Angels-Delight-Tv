import { CheckFailed } from './pipeline';
import { StepFailure } from './runner';
import { CaptureRefused } from './scan-page';

/**
 * 1 means the content is wrong (a screen changed, a check failed, a capture showed real looking data). 2 means the
 * stack itself failed (server down, browser crash, reset refused), reported as infrastructure so nobody rewrites an
 * article for a broken runner (M50-S18).
 */
export function exitCodeFor(error: unknown): 1 | 2 {
  return error instanceof StepFailure ||
    error instanceof CheckFailed ||
    error instanceof CaptureRefused
    ? 1
    : 2;
}
