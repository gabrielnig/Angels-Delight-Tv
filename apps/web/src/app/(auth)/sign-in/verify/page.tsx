import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCardPage } from '../../../../components/AuthLayouts';
import { TwoStepScreen } from '../../../../components/auth/AuthScreens';
import { getAuth, getSite } from '../../../../lib/data';
import { safeNext } from '../../../../lib/data/fixtures/auth';
import { msg } from '@ad/shared/messages';

export const metadata: Metadata = { title: 'Enter your code', robots: { index: false } };

/** The second step after a correct password (M49-S02). Without a waiting sign in there is nothing to do here. */
export default async function SignInVerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [site, params, pending] = await Promise.all([
    getSite().content(),
    searchParams,
    getAuth().hasTwoStepPending(),
  ]);
  if (!pending) redirect('/sign-in');
  return (
    <AuthCardPage site={site}>
      <h1 className="web-auth__title">{msg('auth.twoStep.title')}</h1>
      <TwoStepScreen
        next={params.next ? safeNext(params.next) : undefined}
        supportEmail={site.supportEmail}
      />
    </AuthCardPage>
  );
}
