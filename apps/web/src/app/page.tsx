import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '../components/Shell';
import { AuthSplit } from '../components/AuthLayouts';
import { SignInScreen } from '../components/auth/AuthScreens';
import { HomeSkeleton, HomeView } from '../components/home/HomeView';
import { getSite } from '../lib/data';
import { guestContext } from '../lib/data/types';
import { currentGuestAudience } from '../server/guest/guest-view';
import { guestPlayEnabled } from '../server/guest/guest-settings';
import { requireProfile, getSession } from '../lib/session';
import { JsonLd } from '../components/seo/JsonLd';
import { homePageJsonLd } from '../lib/seo/page-jsonld';
import { getRootTheme } from '../lib/theme/root';
import { siteOrigin } from '../server/seo/page-seo';
import { turnstileSiteKey } from '../server/auth/turnstile-site';
import { pageMetadata } from '../server/seo/site-meta';

export async function generateMetadata() {
  return pageMetadata({ kind: 'website', path: '/' });
}

/** Signed out: Home, or the landing page with the sign in card when guest play is off. Signed in with a profile: Home. */
export default async function RootPage() {
  const session = await getSession();
  if (!session && (await guestPlayEnabled())) {
    // A visitor goes straight to Home (M40). Saving things asks them to sign in later.
    const { platformName } = await getRootTheme();
    return (
      <AppShell>
        <JsonLd data={homePageJsonLd({ origin: siteOrigin(), name: platformName, search: true })} />
        <Suspense fallback={<HomeSkeleton />}>
          <HomeView ctx={guestContext(await currentGuestAudience())} />
        </Suspense>
      </AppShell>
    );
  }
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
