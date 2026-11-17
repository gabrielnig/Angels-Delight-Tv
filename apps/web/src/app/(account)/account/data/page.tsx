import { DataPanel } from '../../../../components/account/DataPanel';
import { getAccount } from '../../../../lib/data';
import { requireProfile } from '../../../../lib/session';

export const metadata = { title: 'Your data' };

export default async function DataPage() {
  const { session } = await requireProfile('/account/data');
  const state = await getAccount().exportState(session.accountId);
  return (
    <>
      <h1 className="web-page__title">Your data</h1>
      <DataPanel initial={state} />
    </>
  );
}
