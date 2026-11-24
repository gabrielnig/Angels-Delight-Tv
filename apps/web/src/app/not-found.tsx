import { Suspense } from 'react';
import { AppShell } from '../components/Shell';
import { ErrorPage } from '../components/errors/ErrorPage';
import { NotFoundSuggestions, SuggestionsSkeleton } from '../components/errors/NotFoundSuggestions';

export const metadata = { title: 'Page not found', robots: { index: false, follow: false } };

/** S139 state 1. One action (R39), a search field and popular titles. Browse stays in the header. */
export default function NotFound() {
  return (
    <AppShell>
      <ErrorPage
        code="404"
        title="We could not find that page"
        description="The link may be old, or the page may have moved."
        search
        action={{ label: 'Back to Home', href: '/' }}
      >
        <Suspense fallback={<SuggestionsSkeleton />}>
          <NotFoundSuggestions heading="Popular right now" />
        </Suspense>
      </ErrorPage>
    </AppShell>
  );
}
