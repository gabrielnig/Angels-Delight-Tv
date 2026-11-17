import { ChangePasswordForm } from '../../../../components/account/ChangePassword';
import { DevicesPanel } from '../../../../components/account/DevicesPanel';
import { getAccount } from '../../../../lib/data';
import { requireProfile } from '../../../../lib/session';

export const metadata = { title: 'Security' };

export default async function SecurityPage() {
  const { session } = await requireProfile('/account/security');
  const devices = await getAccount().devices(session.accountId);
  return (
    <>
      <h1 className="web-page__title">Security</h1>
      <h2>Change password</h2>
      <ChangePasswordForm />
      <h2>Signed in devices</h2>
      <DevicesPanel initial={devices} />
    </>
  );
}
