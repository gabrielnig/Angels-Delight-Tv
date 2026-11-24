import { EmptyState, Row } from '@ad/ui';
import type { CatalogItem } from '../../lib/data';
import { itemKey } from '../../lib/format';
import { CatalogCard } from '../CatalogCard';
import { SearchNotes, type SubjectChip } from './SearchNotes';

/** Search with no matches: tips and popular titles so there is no dead end (M06-S05). */
export function NoResults({
  query,
  popular,
  inList,
  subjects = [],
  didYouMean = null,
}: {
  query: string;
  popular: CatalogItem[];
  inList: string[];
  /** Popular subjects, so there is always somewhere to go (M45-S09). */
  subjects?: SubjectChip[];
  didYouMean?: string | null;
}) {
  const saved = new Set(inList);
  return (
    <>
      <EmptyState
        live
        icon="search"
        title={`No results for "${query}"`}
        description="Check the spelling or try fewer words."
      />
      <SearchNotes query={query} showingFor={null} didYouMean={didYouMean} subjects={subjects} />
      {popular.length > 0 ? (
        <Row title="Popular right now">
          {popular.map((item) => (
            <CatalogCard key={itemKey(item)} item={item} inList={saved.has(itemKey(item))} />
          ))}
        </Row>
      ) : null}
    </>
  );
}
