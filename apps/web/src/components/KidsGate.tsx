'use client';

import { useT } from '../lib/i18n/provider';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, EmptyState } from '@ad/ui';
import { KidsExitDialog } from './KidsExitDialog';

/** Adult only pages on a Kids profile show a password gate dialog, not a redirect (SCREEN-ARCHITECTURE 3.4 rule 5). */
export function KidsGate({ what: whatProp }: { what?: string }) {
  const msg = useT();
  const what = whatProp ?? msg('cards.thisPage');
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <div className="web-page">
      <EmptyState
        icon="lock"
        title={`${what} is for adults`}
        description="Enter your account password to continue."
      />
      <div className="web-center">
        <Button onClick={() => setOpen(true)}>{msg('cards.enterPassword')}</Button>
      </div>
      <KidsExitDialog
        open={open}
        onClose={() => {
          setOpen(false);
          router.push('/');
        }}
        onUnlocked={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
