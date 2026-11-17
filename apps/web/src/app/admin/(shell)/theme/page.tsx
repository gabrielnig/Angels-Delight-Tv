import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { ThemeEditor } from '@/components/admin/theme/ThemeEditor';
import { allowed, requireActor } from '@/lib/data/admin/session-next';
import { themeAdmin } from '@/lib/data/admin/theme';
import { ErrorState } from '@/components/admin/states';
import { publishAction, resetAction, saveDraftAction, uploadLogoAction } from './actions';

export const metadata: Metadata = { title: 'Theme settings' };
export const dynamic = 'force-dynamic';

export default async function ThemePage() {
  const actor = await requireActor('/admin/theme');
  if (!allowed(actor, 'settings.theme')) {
    forbidden();
  }
  const result = await themeAdmin.load(actor);
  if (!result.ok) {
    return (
      <ErrorState
        title="The theme could not be loaded."
        help="Your published theme is still live. Try again in a moment."
      />
    );
  }
  return (
    <ThemeEditor
      initial={result.data}
      actions={{
        saveDraft: saveDraftAction,
        publish: publishAction,
        reset: resetAction,
        uploadLogo: uploadLogoAction,
      }}
    />
  );
}
