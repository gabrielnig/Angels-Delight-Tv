import { ErrorState } from '@ad/ui';
import { getSite } from '../../lib/data';

export const metadata = { title: 'Down for maintenance' };

/** Screen 31. Reads the expected return time from site settings. */
export default async function MaintenancePage() {
  const site = await getSite().content();
  const back = site.maintenance.expectedBack;
  return (
    <main id="main" className="web-page">
      <ErrorState
        variant="page"
        icon="settings"
        title="We are making improvements"
        description={back ? `We expect to be back at ${back}.` : 'We will be back shortly.'}
      />
    </main>
  );
}
