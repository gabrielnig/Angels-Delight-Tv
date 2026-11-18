import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { ToastProvider } from '@/components/admin/Toast';
import { UploaderProvider } from '@/components/admin/UploaderContext';
import { dashboardService, uploadTransportMode } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { getActor } from '@/lib/data/admin/session-next';
import { DEFAULT_PLATFORM_NAME } from '@/lib/platform';
import { DEFAULT_SESSION_POLICIES } from '@ad/auth';
import { realAuthEnabled } from '@/server/auth/mode';
import { realSessionTimes } from '@/server/auth/admin';
import { SessionExpiryWarning } from '@/components/admin/SessionExpiryWarning';
import { extendSessionAction } from '../session-actions';
import { signOutAction } from '../login/actions';
import { noticesAdmin } from '@/lib/data/admin/notices';
import { markNoticesReadAction } from './notice-actions';

export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  // Every page calls requireActor with its own path, so the sign in redirect keeps ?next=.
  if (!actor) return <>{children}</>;
  const counts = await dashboardService.navCounts(actor);
  // A bell that cannot load must not take the admin down with it (M21-S03 error case).
  const feed = await noticesAdmin.feed(actor).catch(() => null);
  const times = realAuthEnabled() ? await realSessionTimes() : null;
  return (
    <UploaderProvider mode={uploadTransportMode()}>
      <ToastProvider>
        <AdminShell
          platformName={DEFAULT_PLATFORM_NAME}
          actor={{ name: actor.name, role: actor.role, roleLabel: ROLE_LABELS[actor.role] }}
          counts={counts}
          signOut={signOutAction}
          notices={feed ? { ...feed, markAllRead: markNoticesReadAction } : undefined}
        >
          {children}
        </AdminShell>
        {times ? (
          <SessionExpiryWarning
            remainingMs={Math.min(times.idleMs, times.absoluteMs)}
            idleMs={DEFAULT_SESSION_POLICIES.staff.idleSeconds * 1000}
            absoluteMs={times.absoluteMs}
            extend={extendSessionAction}
            signInHref="/admin/login?expired=1"
          />
        ) : null}
      </ToastProvider>
    </UploaderProvider>
  );
}
