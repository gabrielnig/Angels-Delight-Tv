'use client';

import { useRouter } from 'next/navigation';
import type { LanguageRow } from '@/lib/i18n/admin-data';
import {
  publishLanguageAction,
  unpublishLanguageAction,
} from '@/app/admin/(shell)/languages/actions';
import { LanguageTable } from './LanguageTable';

export function LanguagesScreen(props: { rows: LanguageRow[]; canPublish: boolean; canOverride: boolean }) {
  const router = useRouter();
  return (
    <LanguageTable
      {...props}
      onPublish={async (code, override) => {
        const result = await publishLanguageAction(code, override);
        if (result.ok) router.refresh();
        return result;
      }}
      onUnpublish={async (code) => {
        const result = await unpublishLanguageAction(code);
        if (result.ok) router.refresh();
        return result;
      }}
    />
  );
}
