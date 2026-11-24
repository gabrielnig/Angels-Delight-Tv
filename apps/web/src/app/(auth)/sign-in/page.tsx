import type { Metadata } from 'next';
import { AuthSplit } from '../../../components/AuthLayouts';
import { SignInScreen } from '../../../components/auth/AuthScreens';
import { getSite } from '../../../lib/data';
import { signInNotice, signInNoticeTone } from '../../../lib/auth-notices';
import { turnstileSiteKey } from '../../../server/auth/turnstile-site';
import { googleButton } from '../../../server/auth/google-runtime';
import { safeNext } from '../../../lib/data/fixtures/auth';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [site, params, google] = await Promise.all([
    getSite().content(),
    searchParams,
    googleButton(),
  ]);
  const next = params.next ? safeNext(params.next) : undefined;
  return (
    <AuthSplit site={site}>
      <h1 className="auth-title">Sign in</h1>
      <SignInScreen
        next={next}
        turnstileSiteKey={turnstileSiteKey()}
        google={google}
        signUpOpen={site.signUpOpen}
        notice={signInNotice(params.notice)}
        noticeTone={signInNoticeTone(params.notice)}
      />
    </AuthSplit>
  );
}
