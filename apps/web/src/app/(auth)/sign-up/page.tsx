import type { Metadata } from 'next';
import { AuthSignUpPage } from '../../../components/AuthLayouts';
import { SignUpScreen } from '../../../components/auth/AuthScreens';
import { getSite } from '../../../lib/data';
import { googleButton } from '../../../server/auth/google-runtime';
import { turnstileSiteKey } from '../../../server/auth/turnstile-site';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignUpPage() {
  const [site, google] = await Promise.all([getSite().content(), googleButton()]);
  return (
    <AuthSignUpPage site={site}>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-lede">Free to watch. Your account keeps your lists and progress.</p>
      <SignUpScreen
        inviteOnly={!site.signUpOpen}
        turnstileSiteKey={turnstileSiteKey()}
        // A closed sign up needs an invite code, which Google cannot carry.
        google={site.signUpOpen ? google : null}
      />
    </AuthSignUpPage>
  );
}
