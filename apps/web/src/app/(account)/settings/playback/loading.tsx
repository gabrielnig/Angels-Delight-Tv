import { AccountFrame } from '../../../../components/account/AccountFrame';
import { SettingsSkeleton } from '../../../../components/account/AccountStates';
import { ACCOUNT_PAGES } from '../../../../components/account/pages';

export default function Loading() {
  const copy = ACCOUNT_PAGES['/settings/playback']!;
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <SettingsSkeleton />
    </AccountFrame>
  );
}
