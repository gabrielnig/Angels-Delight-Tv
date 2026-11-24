import type { Metadata } from 'next';
import { KidsGate } from '../../../../components/KidsGate';
import { EditScreen } from '../../../../components/profiles/ProfileScreens';
import { getProfiles } from '../../../../lib/data';
import { themeRuntime } from '../../../../lib/data/admin/theme-runtime';
import { requireSession } from '../../../../lib/session';
import { suggestProfileName } from '../../../../lib/suggest-name';

export const metadata: Metadata = { title: 'Add a profile' };

export default async function NewProfilePage() {
  const session = await requireSession('/profiles/new');
  if (session.profile?.kids) return <KidsGate what="Adding a profile" />;
  const repo = getProfiles();
  const profiles = await repo.list(session.accountId);
  const languages: string[] = await (await themeRuntime()).settings.get('content.ui_languages');
  return (
    <div className="web-profileform-wrap">
      <EditScreen
        languages={languages}
        limitReached={profiles.length >= repo.maxProfiles}
        lastAdult={false}
        suggestedName={profiles.length === 0 ? suggestProfileName(session.email) : undefined}
      />
    </div>
  );
}
