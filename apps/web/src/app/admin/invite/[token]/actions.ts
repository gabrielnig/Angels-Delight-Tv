'use server';

import { redirect } from 'next/navigation';
import { realAcceptInvite } from '@/server/auth/admin';
import { assertActionOrigin } from '@/server/auth/session';

export interface InviteState {
  error?: string;
  fields?: Record<string, string>;
}

export async function acceptInviteAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  await assertActionOrigin();
  const result = await realAcceptInvite(
    String(form.get('token') ?? ''),
    String(form.get('password') ?? ''),
  );
  if (!result.ok) return { error: result.error, fields: result.fields };
  redirect('/admin/login/2fa');
}
