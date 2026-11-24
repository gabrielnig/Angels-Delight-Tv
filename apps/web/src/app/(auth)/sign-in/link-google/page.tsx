import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCardPage } from '../../../../components/AuthLayouts';
import { LinkGoogleScreen } from '../../../../components/auth/AuthScreens';
import { getSite } from '../../../../lib/data';
import { googleNoteInfo } from '../../../../server/auth/google-runtime';

export const metadata: Metadata = { title: 'Link Google', robots: { index: false } };

/** Rule 4 of the Google link rules: a verified password account must confirm its password once (M49-S06). */
export default async function LinkGooglePage() {
  const [site, note] = await Promise.all([getSite().content(), googleNoteInfo()]);
  if (note?.kind !== 'link') redirect('/sign-in');
  return (
    <AuthCardPage site={site}>
      <LinkGoogleScreen hint={note.hint} />
    </AuthCardPage>
  );
}
