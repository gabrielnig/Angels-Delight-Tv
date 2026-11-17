import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCardPage } from '../../../components/AuthLayouts';
import { VerifyScreen } from '../../../components/auth/AuthScreens';
import { getSite } from '../../../lib/data';
import { maskEmail } from '../../../lib/format';
import { getSession } from '../../../lib/session';

export const metadata: Metadata = { title: 'Verify email' };

export default async function VerifyEmailPage() {
  const [site, session] = await Promise.all([getSite().content(), getSession()]);
  if (!session) redirect('/sign-in');
  return (
    <AuthCardPage site={site}>
      <h1 className="web-auth__title">Check your email</h1>
      <VerifyScreen maskedEmail={maskEmail(session.email)} />
    </AuthCardPage>
  );
}
