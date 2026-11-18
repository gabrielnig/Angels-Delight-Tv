import { AccountFrame } from '../../../../components/account/AccountFrame';
import { AdultsOnly } from '../../../../components/account/AccountStates';
import { DataPanel } from '../../../../components/account/DataPanel';
import { ACCOUNT_PAGES } from '../../../../components/account/pages';
import { getAccount } from '../../../../lib/data';
import { requireProfile } from '../../../../lib/session';

export const metadata = { title: 'Data and privacy' };

export default async function DataPage() {
  const { session, profile } = await requireProfile('/account/data');
  if (profile.kids) return <AdultsOnly profileName={profile.name} />;
  const [state, overview] = await Promise.all([
    getAccount().exportState(session.accountId),
    getAccount().overview(session.accountId),
  ]);
  const copy = ACCOUNT_PAGES['/account/data']!;
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <DataPanel initial={state} email={overview.email} />
    </AccountFrame>
  );
}
