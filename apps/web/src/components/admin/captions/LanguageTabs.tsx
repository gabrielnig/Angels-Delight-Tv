import Link from 'next/link';
import { localeInfo } from '@ad/shared';

export interface LanguageTab {
  language: string;
  state: 'approved' | 'needs_review' | 'rejected' | 'none';
}

const STATE_WORD: Record<LanguageTab['state'], string> = {
  approved: 'Approved',
  needs_review: 'Needs review',
  rejected: 'Rejected',
  none: 'Not started',
};

/** Language tabs for the caption review screen. Plain links, so each tab is a page and the back button works. */
export function LanguageTabs({
  videoId,
  tabs,
  current,
  spoken,
}: {
  videoId: string;
  tabs: LanguageTab[];
  current: string;
  spoken: string;
}) {
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Caption languages" className="adm-row adm-langtabs">
      {tabs.map((tab) => {
        const name = localeInfo(tab.language)?.englishName ?? tab.language;
        const selected = tab.language === current;
        return (
          <Link
            key={tab.language}
            className={`adm-langtab${selected ? ' is-current' : ''}`}
            aria-current={selected ? 'page' : undefined}
            href={tab.language === spoken ? `/admin/captions/${videoId}` : `/admin/captions/${videoId}?lang=${tab.language}`}
          >
            {`${name}, ${tab.language === spoken ? 'spoken' : STATE_WORD[tab.state]}`}
          </Link>
        );
      })}
    </nav>
  );
}
