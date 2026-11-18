import { AppShell } from '../../../components/Shell';
import { HelpFaq } from '../../../components/site/HelpFaq';
import { LegalView } from '../../../components/site/LegalView';
import { getSite } from '../../../lib/data';

export const metadata = { title: 'Help' };

/** The help text is the page the admin edits, with the common questions underneath (M26-S02, M26-S03). */
export default async function HelpPage() {
  const [page, articles, site] = await Promise.all([
    getSite().legal('help'),
    getSite().helpArticles(),
    getSite().content(),
  ]);
  const hasText = page !== null && (page.html !== undefined || page.sections.length > 0);
  return (
    <AppShell>
      {hasText ? <LegalView page={page} /> : null}
      <div className="web-page web-legal">
        {hasText ? null : <h1 className="web-page__title">Help</h1>}
        <HelpFaq articles={articles} supportEmail={site.supportEmail} />
      </div>
    </AppShell>
  );
}
