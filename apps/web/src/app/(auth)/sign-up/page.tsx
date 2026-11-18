import type { Metadata } from 'next';
import { AuthSignUpPage } from '../../../components/AuthLayouts';
import { SignUpScreen } from '../../../components/auth/AuthScreens';
import { getSite } from '../../../lib/data';
import { turnstileSiteKey } from '../../../server/auth/turnstile-site';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignUpPage() {
  const site = await getSite().content();
  return (
    <AuthSignUpPage site={site}>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-lede">Free to watch. Your account keeps your lists and progress.</p>
      <SignUpScreen inviteOnly={!site.signUpOpen} turnstileSiteKey={turnstileSiteKey()} />
    </AuthSignUpPage>
  );
}
