import { AccountFrame } from '../../../components/account/AccountFrame';
import { AccountOverview } from '../../../components/account/AccountOverview';
import { AdultsOnly } from '../../../components/account/AccountStates';
import { ACCOUNT_PAGES } from '../../../components/account/pages';
import { getAccount, getProfiles } from '../../../lib/data';
import { requireProfile } from '../../../lib/session';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const { session, profile } = await requireProfile('/account');
  if (profile.kids) return <AdultsOnly profileName={profile.name} />;
  const [overview, profiles, devices] = await Promise.all([
    getAccount().overview(session.accountId),
    getProfiles().list(session.accountId),
    getAccount().devices(session.accountId),
  ]);
  const here = devices.find((d) => d.current);
  const copy = ACCOUNT_PAGES['/account']!;
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <AccountOverview
        overview={overview}
        profiles={profiles}
        maxProfiles={getProfiles().maxProfiles}
        currentDevice={here ? `${here.label}, ${here.place}` : null}
      />
    </AccountFrame>
  );
}
