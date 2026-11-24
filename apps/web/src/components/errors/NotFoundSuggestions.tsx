import { Row, SkeletonRegion } from '@ad/ui';
import { itemKey } from '../../lib/format';
import { getCatalog } from '../../lib/data';
import { getViewerOrGuest } from '../../lib/session';
import { CatalogCard } from '../CatalogCard';
import './errors.css';

/** Popular titles under an error message. Left out when none load, so a failure never adds a second error. */
export async function NotFoundSuggestions({ heading }: { heading: string }) {
  try {
    const { ctx } = await getViewerOrGuest('/');
    const items = (await getCatalog().popular(ctx)).slice(0, 10);
    if (items.length === 0) return null;
    return (
      <div className="ad-error-suggestions">
        <Row title={heading}>
          {items.map((item) => (
            <CatalogCard key={itemKey(item)} item={item} inList={false} />
          ))}
        </Row>
      </div>
    );
  } catch {
    return null;
  }
}

/** Five 16 by 9 cards that hold the space while popular titles load. Appears after 300 ms. */
export function SuggestionsSkeleton({ delayMs }: { delayMs?: number }) {
  return (
    <SkeletonRegion className="ad-error-suggestions" {...(delayMs === undefined ? {} : { delayMs })}>
      <div className="ad-error-sk-row">
        {[0, 1, 2, 3, 4].map((n) => (
          <span key={n} className="ad-error-sk ad-skeleton" aria-hidden="true" />
        ))}
      </div>
    </SkeletonRegion>
  );
}
