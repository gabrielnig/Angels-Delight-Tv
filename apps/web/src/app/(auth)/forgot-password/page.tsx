import type { Metadata } from 'next';
import { AuthCardPage } from '../../../components/AuthLayouts';
import { ForgotScreen } from '../../../components/auth/AuthScreens';
import { getSite } from '../../../lib/data';

export const metadata: Metadata = { title: 'Forgot password' };

export default async function ForgotPasswordPage() {
  const site = await getSite().content();
  return (
    <AuthCardPage site={site}>
      <ForgotScreen />
    </AuthCardPage>
  );
}
