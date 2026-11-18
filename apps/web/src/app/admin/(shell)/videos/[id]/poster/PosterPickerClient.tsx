'use client';

import type { ComponentProps } from 'react';
import { PosterPicker } from '@/components/admin/PosterPicker';

type Props = Omit<ComponentProps<typeof PosterPicker>, 'upload' | 'status'> & {
  uploadAction: (
    formData: FormData,
  ) => Promise<{ ok: true; assetId: string } | { ok: false; error: string }>;
  statusAction: (assetId: string) => Promise<{ status: 'processing' | 'ready' | 'failed' }>;
};

/** Binds the server actions to the picker, turning the chosen file into the form data the action reads. */
export function PosterPickerClient({ uploadAction, statusAction, ...props }: Props) {
  return (
    <PosterPicker
      {...props}
      upload={(file) => {
        const body = new FormData();
        body.set('file', file);
        return uploadAction(body);
      }}
      status={statusAction}
    />
  );
}
