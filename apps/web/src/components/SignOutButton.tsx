'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from '@ad/ui';
import { signOutAction } from '../app/actions';
import { clearServiceWorkerCaches } from '../lib/pwa/purge';
import { requestSignOut } from '../lib/pwa/sign-out';

/**
 * Works offline: private state is cleared here at once and the revocation is queued (M01-S10).
 * `plain` drops the button look so a row can style it.
 */
export function SignOutButton({
  variant = 'ghost',
  className,
  children = 'Sign out',
}: {
  variant?: ButtonVariant | 'plain';
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  async function signOut() {
    await requestSignOut({
      store: localStorage,
      online: () => navigator.onLine,
      signOut: signOutAction,
      clearCaches: () => clearServiceWorkerCaches(navigator),
    });
    router.push('/');
    router.refresh();
  }
  if (variant === 'plain') {
    return (
      <button type="button" className={className} onClick={() => void signOut()}>
        {children}
      </button>
    );
  }
  return (
    <Button variant={variant} className={className} onClick={() => void signOut()}>
      {children}
    </Button>
  );
}
