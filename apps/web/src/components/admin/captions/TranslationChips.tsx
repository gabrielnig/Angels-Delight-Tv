import { localeInfo } from '@ad/shared';
import type { CaptionRow } from '@/lib/data/admin/services';
import { Icon, type IconName } from '../Icon';

type Chip = NonNullable<CaptionRow['translations']>[number];

/** Language, then state as an icon plus a word. Live means approved and published. */
function describe(chip: Chip): { text: string; icon: IconName } {
  if (chip.state === 'rejected') return { text: 'Rejected', icon: 'alert' };
  if (chip.state === 'needs_review') return { text: 'Needs review', icon: 'clock' };
  const base = chip.published ? 'Live' : 'Approved, not live';
  return { text: chip.sourceChanged ? `${base}, Source changed` : base, icon: chip.published ? 'eye' : 'check' };
}

/** One chip per translated language on the Captions list (M46-S15). The state is never colour alone. */
export function TranslationChips({ translations }: { translations: Chip[] }) {
  if (translations.length === 0) return null;
  return (
    <ul className="adm-chips" aria-label="Translations">
      {translations.map((chip) => {
        const { text, icon } = describe(chip);
        const name = localeInfo(chip.language)?.englishName ?? chip.language;
        return (
          <li key={chip.language} className="adm-chip">
            <Icon name={icon} size={14} aria-hidden="true" />
            <span>{`${name}, ${text}`}</span>
          </li>
        );
      })}
    </ul>
  );
}
