import { Suspense } from 'react';
import { AppShell } from '../../../../components/Shell';
import { ErrorPage } from '../../../../components/errors/ErrorPage';
import {
  NotFoundSuggestions,
  SuggestionsSkeleton,
} from '../../../../components/errors/NotFoundSuggestions';

export const metadata = { title: 'Series not found', robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <AppShell>
      <ErrorPage
        title="This series is no longer available"
        description="It may have been removed or made private. Search, or watch something like it."
        search
        action={{ label: 'Back to Home', href: '/' }}
      >
        <Suspense fallback={<SuggestionsSkeleton />}>
          <NotFoundSuggestions heading="More like this" />
        </Suspense>
      </ErrorPage>
    </AppShell>
  );
}
