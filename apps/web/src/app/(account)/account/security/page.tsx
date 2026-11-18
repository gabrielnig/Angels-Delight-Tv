import { AccountFrame } from '../../../../components/account/AccountFrame';
import { AdultsOnly } from '../../../../components/account/AccountStates';
import { SecurityView } from '../../../../components/account/SecurityView';
import { ACCOUNT_PAGES } from '../../../../components/account/pages';
import { getAccount } from '../../../../lib/data';
import { requireProfile } from '../../../../lib/session';

export const metadata = { title: 'Security' };

export default async function SecurityPage() {
  const { session, profile } = await requireProfile('/account/security');
  if (profile.kids) return <AdultsOnly profileName={profile.name} />;
  const [overview, devices] = await Promise.all([
    getAccount().overview(session.accountId),
    getAccount().devices(session.accountId),
  ]);
  const copy = ACCOUNT_PAGES['/account/security']!;
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <SecurityView
        email={overview.email}
        verified={overview.verified}
        passwordChanged={overview.passwordChanged}
        devices={devices}
      />
    </AccountFrame>
  );
}
