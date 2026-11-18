import type { Metadata } from 'next';
import { AuthLayout } from '@/components/admin/AuthLayout';
import { LinkButton } from '@/components/admin/Button';
import { realInspectInvite } from '@/server/auth/admin';
import { realAuthEnabled } from '@/server/auth/mode';
import { AcceptInviteForm } from './AcceptInviteForm';

export const metadata: Metadata = { title: 'Accept invite' };
export const dynamic = 'force-dynamic';

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = realAuthEnabled() ? await realInspectInvite(token) : null;
  if (!invite) {
    return (
      <AuthLayout
        title="This invite has expired"
        lead="Invites last 72 hours and work once. Ask the person who invited you to send a new one."
      >
        <LinkButton href="/admin/login" variant="primary">
          Go to admin sign in
        </LinkButton>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      title="Accept your invite"
      lead={`Choose a password to join as ${invite.role === 'super_admin' ? 'a Super admin' : invite.role === 'admin' ? 'an admin' : 'a content editor'}. You will set up two factor sign in next.`}
    >
      <AcceptInviteForm token={token} />
    </AuthLayout>
  );
}
