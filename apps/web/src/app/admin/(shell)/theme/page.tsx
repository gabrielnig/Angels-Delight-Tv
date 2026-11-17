import type { Metadata } from 'next';
import { ThemeEditor } from '@/components/admin/theme/ThemeEditor';
import { NoAccess } from '@/components/admin/states';
import { allowed, requireActor } from '@/lib/data/admin/session-next';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { themeAdmin } from '@/lib/data/admin/theme';
import { ErrorState } from '@/components/admin/states';
import { publishAction, resetAction, saveDraftAction, uploadLogoAction } from './actions';

export const metadata: Metadata = { title: 'Theme settings' };
export const dynamic = 'force-dynamic';

export default async function ThemePage() {
  const actor = await requireActor('/admin/theme');
  if (!allowed(actor, 'settings.theme')) {
    return (
      <NoAccess pageName="Theme settings" roleLabel={ROLE_LABELS[actor.role]} needed="admins" />
    );
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
