import { AccountFrame } from '../../../../components/account/AccountFrame';
import { AdultsOnly } from '../../../../components/account/AccountStates';
import { SecurityView } from '../../../../components/account/SecurityView';
import { ACCOUNT_PAGES } from '../../../../components/account/pages';
import { getAccount } from '../../../../lib/data';
import { requireProfile } from '../../../../lib/session';
import { googleCardState } from '../../../../server/auth/google-runtime';

export const metadata = { title: 'Security' };

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session, profile } = await requireProfile('/account/security');
  if (profile.kids) return <AdultsOnly profileName={profile.name} />;
  const [overview, devices, twoFactor, history, google, params] = await Promise.all([
    getAccount().overview(session.accountId),
    getAccount().devices(session.accountId),
    getAccount().twoFactor(session.accountId),
    getAccount().loginHistory(session.accountId),
    googleCardState(),
    searchParams,
  ]);
  const copy = ACCOUNT_PAGES['/account/security']!;
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <SecurityView
        email={overview.email}
        verified={overview.verified}
        passwordChanged={overview.passwordChanged}
        devices={devices}
        twoFactor={twoFactor}
        history={history}
        google={google}
        notice={params.notice}
      />
    </AccountFrame>
  );
}
