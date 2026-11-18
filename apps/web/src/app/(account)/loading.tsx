import { AccountFrame } from '../../components/account/AccountFrame';
import { AccountOverviewSkeleton } from '../../components/account/AccountStates';
import { ACCOUNT_PAGES } from '../../components/account/pages';

/** Fallback for every account route: heading and nav stay put while the cards load (S27 state 2). */
export default function Loading() {
  const copy = ACCOUNT_PAGES['/account']!;
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <AccountOverviewSkeleton />
    </AccountFrame>
  );
}
