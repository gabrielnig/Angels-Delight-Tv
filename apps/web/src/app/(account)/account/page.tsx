import { formatDate, maskEmail } from '../../../lib/format';
import { getAccount } from '../../../lib/data';
import { requireProfile } from '../../../lib/session';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const { session } = await requireProfile('/account');
  const o = await getAccount().overview(session.accountId);
  return (
    <>
      <h1 className="web-page__title">Account</h1>
      <dl className="web-facts">
        <dt>Name</dt>
        <dd>{o.displayName}</dd>
        <dt>Email</dt>
        <dd>{maskEmail(o.email)}</dd>
        <dt>Member since</dt>
        <dd>{formatDate(o.memberSince)}</dd>
        <dt>Watched this month</dt>
        <dd>{o.watchedThisMonth}</dd>
        <dt>Minutes learning</dt>
        <dd>{o.minutesLearning}</dd>
        <dt>Saved in My List</dt>
        <dd>{o.myListCount}</dd>
        <dt>Signed in devices</dt>
        <dd>{o.devices}</dd>
      </dl>
    </>
  );
}
