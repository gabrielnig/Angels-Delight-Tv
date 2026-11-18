import { redirect } from 'next/navigation';
import { DeletionNoticeScreen } from '../../../../components/account/DeletionNoticeScreen';
import { getAccount } from '../../../../lib/data';
import { currentAccountId } from '../../../../lib/session';

export const metadata = { title: 'Account closing' };
export const dynamic = 'force-dynamic';

/** The only screen an account waiting to be deleted can use. Anyone else is sent on (M02-S08 AC2). */
export default async function DeletionPage() {
  let accountId: string;
  try {
    accountId = await currentAccountId();
  } catch {
    redirect('/sign-in?next=%2Faccount%2Fdeletion');
  }
  const state = await getAccount().deletionState(accountId);
  if (!state.pending) redirect('/profiles');
  return <DeletionNoticeScreen purgeDate={state.purgeDate} days={state.days} />;
}
