import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '../components/Shell';
import { AuthSplit } from '../components/AuthLayouts';
import { SignInScreen } from '../components/auth/AuthScreens';
import { HomeSkeleton, HomeView } from '../components/home/HomeView';
import { getSite } from '../lib/data';
import { requireProfile, getSession } from '../lib/session';
import { turnstileSiteKey } from '../server/auth/turnstile-site';

/** Signed out: the landing page with the sign in card. Signed in with a profile: Home. */
export default async function RootPage() {
  const session = await getSession();
  if (!session) {
    const site = await getSite().content();
    return (
      <AuthSplit site={site}>
        <h1 className="auth-title">Sign in</h1>
        <SignInScreen signUpOpen={site.signUpOpen} turnstileSiteKey={turnstileSiteKey()} />
      </AuthSplit>
    );
  }
  if (!session.verified) redirect('/verify-email');
  if (!session.profile) redirect('/profiles');
  const { ctx, profile, session: viewer } = await requireProfile('/');
  return (
    <AppShell>
      <Suspense fallback={<HomeSkeleton />}>
        <HomeView ctx={ctx} dataSaver={profile.dataSaver} canUpload={viewer.canUpload} />
      </Suspense>
    </AppShell>
  );
}
