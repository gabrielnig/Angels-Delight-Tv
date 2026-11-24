'use client';

import { ListPageError } from '../../../components/browse/ListPageView';

export default function BrowseError({ reset }: { error: Error; reset: () => void }) {
  return <ListPageError reset={reset} />;
}
