import { AccountOverview } from '../../../components/account/AccountOverview';
import { getAccount } from '../../../lib/data';
import { requireProfile } from '../../../lib/session';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const { session } = await requireProfile('/account');
  const o = await getAccount().overview(session.accountId);
  return <AccountOverview overview={o} />;
}
