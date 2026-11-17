import { ErrorState } from '@ad/ui';

export const metadata = { title: 'Browser not supported' };

/** Screen 32. A plain page that needs no scripts. */
export default function UnsupportedPage() {
  return (
    <main id="main" className="web-page">
      <ErrorState
        variant="page"
        icon="info"
        title="Please update your browser"
        description="This browser is too old to play videos safely. Open this site in a recent version of Chrome, Safari, Edge or Firefox."
      />
    </main>
  );
}
