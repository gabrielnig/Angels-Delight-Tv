import { AppShell } from '../../../components/Shell';
import { HelpFaq } from '../../../components/site/HelpFaq';
import { getSite } from '../../../lib/data';

export const metadata = { title: 'Help' };

export default async function HelpPage() {
  const [articles, site] = await Promise.all([getSite().helpArticles(), getSite().content()]);
  return (
    <AppShell>
      <div className="web-page web-legal">
        <h1 className="web-page__title">Help</h1>
        <HelpFaq articles={articles} supportEmail={site.supportEmail} />
      </div>
    </AppShell>
  );
}
