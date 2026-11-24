import type { Metadata } from 'next';
import Link from 'next/link';
import { msg } from '@ad/shared/messages';
import { AuthCardPage } from '../../../../components/AuthLayouts';
import { getSite } from '../../../../lib/data';

export const metadata: Metadata = {
  title: 'Google sign in failed',
  robots: { index: false },
};

/**
 * The one page every failed Google check lands on (M49-S05 AC3 and AC4). It never says why: the reason is in the
 * audit log, not on screen.
 */
export default async function GoogleFailedPage() {
  const site = await getSite().content();
  return (
    <AuthCardPage site={site}>
      <h1 className="web-auth__title">{msg('auth.google.failedTitle')}</h1>
      <p className="web-muted">{msg('auth.google.failedLead')}</p>
      <Link
        href="/sign-in"
        className="ad-btn"
        data-variant="primary"
        data-size="lg"
        data-full="true"
      >
        {msg('auth.google.failedAction')}
      </Link>
    </AuthCardPage>
  );
}
