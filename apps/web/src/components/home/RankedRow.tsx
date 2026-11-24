import { Row } from '@ad/ui';
import type { HomeRow } from '../../lib/data';
import { itemKey } from '../../lib/format';
import { CatalogCard } from '../CatalogCard';

/** Row kinds this component draws (M44-S07, S09, S10). Anything else uses the plain row. */
export const RANKED_KINDS = new Set(['trending', 'top_ten', 'most_liked']);

/**
 * Trending now and Most liked are plain card rows. Top 10 is an ordered list: each tile has its numeral beside it,
 * hidden from assistive technology, and its link starts with "Number 3," so rank is never carried by the numeral
 * alone. A row with no titles draws nothing (no empty headings, no relabelling).
 */
export function RankedRow({
  row,
  inList,
  viewAllLabel,
}: {
  row: HomeRow;
  inList: Set<string>;
  viewAllLabel?: string;
}) {
  const ranked = row.kind === 'top_ten';
  return (
    <Row
      title={row.title}
      ordered={ranked}
      className={ranked ? 'ad-row--ranked' : undefined}
      viewAllHref={row.viewAll?.href}
      viewAllExternal={row.viewAll?.external}
      viewAllLabel={viewAllLabel}
    >
      {row.items.map((item, index) => {
        const card = (
          <CatalogCard
            key={itemKey(item)}
            item={item}
            inList={inList.has(itemKey(item))}
            rank={ranked ? index + 1 : undefined}
          />
        );
        return ranked ? (
          <div key={itemKey(item)} className="ad-ranked">
            <span className="ad-ranked__num" aria-hidden="true">
              {index + 1}
            </span>
            {card}
          </div>
        ) : (
          card
        );
      })}
    </Row>
  );
}
