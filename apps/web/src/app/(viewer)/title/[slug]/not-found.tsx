import { Suspense } from 'react';
import { ErrorPage } from '../../../../components/errors/ErrorPage';
import {
  NotFoundSuggestions,
  SuggestionsSkeleton,
} from '../../../../components/errors/NotFoundSuggestions';

export const metadata = { title: 'Video not found', robots: { index: false, follow: false } };

/** S139 state 3. The layout keeps the header. Next sends HTTP 404 for a not found boundary. */
export default function NotFound() {
  return (
    <ErrorPage
      title="This video is no longer available"
      description="It may have been removed or made private. Search, or watch something like it."
      search
      action={{ label: 'Back to Home', href: '/' }}
    >
      <Suspense fallback={<SuggestionsSkeleton />}>
        <NotFoundSuggestions heading="More like this" />
      </Suspense>
    </ErrorPage>
  );
}
