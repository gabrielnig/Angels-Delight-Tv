import { ButtonLink, ErrorState } from '@ad/ui';
import { AppShell } from '../components/Shell';

export const metadata = { title: 'Page not found' };

/** Screen 29. Works signed in or out. */
export default function NotFound() {
  return (
    <AppShell>
      <div className="web-page">
        <ErrorState
          variant="page"
          icon="search"
          title="We could not find that page"
          description="It may have moved or the link may be wrong."
          actions={
            <>
              <ButtonLink href="/">Back to Home</ButtonLink>
              <ButtonLink href="/search" variant="secondary">
                Search
              </ButtonLink>
            </>
          }
        />
      </div>
    </AppShell>
  );
}
