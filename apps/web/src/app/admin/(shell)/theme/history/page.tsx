import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { ThemeHistoryView } from '@/components/admin/theme/ThemeHistoryView';
import { ErrorState } from '@/components/admin/states';
import { allowed, requireActor } from '@/lib/data/admin/session-next';
import { themeAdmin } from '@/lib/data/admin/theme';
import { loadHistoryAction, loadVersionAction, restoreVersionAction } from '../actions';

export const metadata: Metadata = { title: 'Theme history' };
export const dynamic = 'force-dynamic';

export default async function ThemeHistoryPage() {
  const actor = await requireActor('/admin/theme/history');
  if (!allowed(actor, 'settings.theme')) {
    forbidden();
  }
  const result = await themeAdmin.history(actor, { filter: 'all' });
  if (!result.ok) return <ErrorState title="The history could not be loaded." />;
  return (
    <ThemeHistoryView
      initial={result.data}
      actions={{
        load: loadHistoryAction,
        loadVersion: loadVersionAction,
        restore: restoreVersionAction,
      }}
    />
  );
}
