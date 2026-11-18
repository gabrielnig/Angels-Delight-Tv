'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@ad/ui';
import { signOutAction } from '../app/actions';
import { clearServiceWorkerCaches } from '../lib/pwa/purge';
import { requestSignOut } from '../lib/pwa/sign-out';

/** Works offline: private state is cleared here at once and the revocation is queued (M01-S10). */
export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await requestSignOut({
          store: localStorage,
          online: () => navigator.onLine,
          signOut: signOutAction,
          clearCaches: () => clearServiceWorkerCaches(navigator),
        });
        router.push('/');
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
