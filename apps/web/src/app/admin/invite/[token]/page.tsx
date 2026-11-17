import type { Metadata } from 'next';
import { AuthLayout } from '@/components/admin/AuthLayout';
import { LinkButton } from '@/components/admin/Button';

export const metadata: Metadata = { title: 'Accept invite' };

/**
 * Invite acceptance needs the auth lane (token lookup, password, 2FA enrolment). Until then every
 * token shows the expired state so no one can create an account from the fixture build.
 */
export default function AcceptInvitePage() {
  return (
    <AuthLayout
      title="This invite has expired"
      lead="Invites last 7 days and work once. Ask the person who invited you to send a new one."
    >
      <LinkButton href="/admin/login" variant="primary">
        Go to admin sign in
      </LinkButton>
    </AuthLayout>
  );
}
