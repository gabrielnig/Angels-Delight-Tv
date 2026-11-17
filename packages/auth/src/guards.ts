import { Forbidden, Unauthorized } from '@ad/shared';
import type { SessionContext } from './sessions';

/**
 * Staff access needs a staff role and a session that passed the second factor. Role checks live in every
 * handler (SECURITY.md section 5), this is the shared first step. Unknown roles are refused.
 */
export function assertStaff(context: SessionContext | null): asserts context is SessionContext {
  if (!context) throw new Unauthorized();
  if (context.role !== 'editor' && context.role !== 'admin') throw new Forbidden();
  if (!context.mfaVerified) throw new Forbidden('Second factor required');
}

export function assertAdmin(context: SessionContext | null): asserts context is SessionContext {
  assertStaff(context);
  if (context.role !== 'admin') throw new Forbidden();
}
