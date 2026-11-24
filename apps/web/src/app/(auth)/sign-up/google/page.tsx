import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCardPage } from '../../../../components/AuthLayouts';
import { FinishGoogleScreen } from '../../../../components/auth/AuthScreens';
import { getSite } from '../../../../lib/data';
import { googleNoteInfo } from '../../../../server/auth/google-runtime';

export const metadata: Metadata = { title: 'Finish setting up', robots: { index: false } };

/** One screen of terms and age consent for a brand new Google account (M49-S05 AC2). */
export default async function FinishGoogleSignUpPage() {
  const [site, note] = await Promise.all([getSite().content(), googleNoteInfo()]);
  if (note?.kind !== 'signup') redirect('/sign-in');
  return (
    <AuthCardPage site={site}>
      <FinishGoogleScreen hint={note.hint} />
    </AuthCardPage>
  );
}
