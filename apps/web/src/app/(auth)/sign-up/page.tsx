import type { Metadata } from 'next';
import { AuthCardPage } from '../../../components/AuthLayouts';
import { SignUpScreen } from '../../../components/auth/AuthScreens';
import { getSite } from '../../../lib/data';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignUpPage() {
  const site = await getSite().content();
  return (
    <AuthCardPage site={site}>
      <h1 className="web-auth__title">Create your account</h1>
      <p className="web-muted">Free to watch. Your account keeps your lists and progress.</p>
      <SignUpScreen inviteOnly={!site.signUpOpen} />
    </AuthCardPage>
  );
}
