import { PipelineError } from '../../failure';

export function assertWithinCap(a: { used: number; adding: number; cap: number }): void {
  if (a.cap <= 0) {
    throw new PipelineError('caption_service_unavailable', 'translation cap is 0, API use is not allowed', true);
  }
  if (a.used + a.adding > a.cap) {
    throw new PipelineError('caption_service_unavailable', 'monthly translation character cap reached', true);
  }
}
