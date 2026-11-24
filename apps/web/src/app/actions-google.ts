'use server';

import { assertActionOrigin } from '../server/auth/session';
import { googleFlow } from '../server/auth/google-runtime';

/**
 * Server actions for the Google screens (M49-S05, S06). Each one checks the request origin, then asks the flow,
 * which owns every rule. With no keys configured the flow does not exist and each action answers as if the
 * step had expired, so nothing about Google is reachable.
 */

export async function confirmGoogleLinkAction(password: string) {
  await assertActionOrigin();
  const flow = googleFlow();
  if (!flow) return { ok: false as const, reason: 'expired' as const };
  return flow.confirmLink(password);
}

export async function finishGoogleSignUpAction() {
  await assertActionOrigin();
  const flow = googleFlow();
  if (!flow) return { ok: false as const, reason: 'expired' as const };
  return flow.finishSignUp({ acceptTerms: true, guardianDeclaration: true });
}

export async function unlinkGoogleAction(password: string) {
  await assertActionOrigin();
  const flow = googleFlow();
  if (!flow) return { ok: false as const, reason: 'network' as const };
  return flow.unlink(password);
}
