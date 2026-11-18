import { AccountFrame } from '../../../../components/account/AccountFrame';
import { AccountOverviewSkeleton } from '../../../../components/account/AccountStates';
import { ACCOUNT_PAGES } from '../../../../components/account/pages';

export default function Loading() {
  const copy = ACCOUNT_PAGES['/account/security']!;
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <AccountOverviewSkeleton label="Loading your security settings" />
    </AccountFrame>
  );
}
