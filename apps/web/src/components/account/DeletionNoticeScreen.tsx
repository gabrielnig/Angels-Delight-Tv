'use client';

import { useRouter } from 'next/navigation';
import { cancelDeletionAction, signOutAction } from '../../app/actions';
import { DeletionNotice } from './DeletionNotice';

export function DeletionNoticeScreen({ purgeDate, days }: { purgeDate: string; days: number }) {
  const router = useRouter();
  return (
    <DeletionNotice
      purgeDate={purgeDate}
      days={days}
      onCancel={async () => {
        const result = await cancelDeletionAction();
        if (result.ok) {
          router.push('/profiles');
          router.refresh();
        }
        return result;
      }}
      onSignOut={async () => {
        await signOutAction();
        router.push('/');
        router.refresh();
      }}
    />
  );
}
