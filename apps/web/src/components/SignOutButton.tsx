'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@ad/ui';
import { signOutAction } from '../app/actions';

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await signOutAction();
        router.push('/');
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
