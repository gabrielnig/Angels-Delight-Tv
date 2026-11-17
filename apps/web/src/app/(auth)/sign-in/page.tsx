import type { Metadata } from 'next';
import { AuthSplit } from '../../../components/AuthLayouts';
import { SignInScreen } from '../../../components/auth/AuthScreens';
import { getSite } from '../../../lib/data';
import { safeNext } from '../../../lib/data/fixtures/auth';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [site, params] = await Promise.all([getSite().content(), searchParams]);
  const next = params.next ? safeNext(params.next) : undefined;
  return (
    <AuthSplit site={site}>
      <h1 className="web-auth__title">Sign in</h1>
      <SignInScreen
        next={next}
        signUpOpen={site.signUpOpen}
        notice={
          params.notice === 'reset'
            ? 'Your password was changed. Sign in with your new password.'
            : undefined
        }
      />
    </AuthSplit>
  );
}
