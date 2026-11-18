import { EmptyState } from '@ad/ui';

/** Home with nothing to show (M05-S07, M35-S01). */
export function HomeEmpty({ platformName, kids }: { platformName: string; kids: boolean }) {
  return (
    <div className="web-page">
      <h1 className="ad-sr-only">Home</h1>
      {kids ? (
        <EmptyState title="Nothing here yet. Ask a grown-up to switch profile." />
      ) : (
        <EmptyState
          title="New videos are on the way"
          description={`${platformName} is getting ready. Check back soon.`}
          action={{ label: 'About', href: '/about' }}
        />
      )}
    </div>
  );
}
