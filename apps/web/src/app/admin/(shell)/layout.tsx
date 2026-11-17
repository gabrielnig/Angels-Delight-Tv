import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { ToastProvider } from '@/components/admin/Toast';
import { UploaderProvider } from '@/components/admin/UploaderContext';
import { dashboardService, uploadTransportMode } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';
import { DEFAULT_PLATFORM_NAME } from '@/lib/platform';
import { signOutAction } from '../login/actions';

export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  const counts = await dashboardService.navCounts(actor);
  return (
    <UploaderProvider mode={uploadTransportMode()}>
      <ToastProvider>
        <AdminShell
          platformName={DEFAULT_PLATFORM_NAME}
          actor={{ name: actor.name, role: actor.role, roleLabel: ROLE_LABELS[actor.role] }}
          counts={counts}
          signOut={signOutAction}
        >
          {children}
        </AdminShell>
      </ToastProvider>
    </UploaderProvider>
  );
}
