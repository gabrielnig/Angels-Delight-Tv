import { Hero, Row, SkeletonRegion, SkeletonRow, EmptyState, type HeroItem } from '@ad/ui';
import {
  getCatalog,
  getLibrary,
  type CatalogItem,
  type HomeData,
  type Progress,
  type ViewerContext,
} from '../../lib/data';
import { itemHref, itemKey, metaLine, timeLeftLabel } from '../../lib/format';
import { CatalogCard, ContinueRow } from '../CatalogCard';
import { RowError } from '../RowError';

function heroItems(home: HomeData, progress: Map<string, Progress>): HeroItem[] {
  return home.hero.map(({ item, blurb }) => {
    const video = item.kind === 'video' ? item : null;
    const resume = video ? progress.get(video.id) : undefined;
    return {
      id: item.kind === 'video' ? item.id : item.slug,
      title: item.title,
      description: blurb ?? item.description,
      meta: metaLine(item),
      playHref: video
        ? `/watch/${video.id}${resume ? `?t=${Math.floor(resume.positionSeconds)}` : ''}`
        : itemHref(item),
      infoHref: itemHref(item),
      resumeLabel:
        resume && resume.positionSeconds < resume.durationSeconds * 0.95
          ? timeLeftLabel(resume)
          : undefined,
    };
  });
}

function cards(items: CatalogItem[], inList: Set<string>) {
  return items.map((item) => (
    <CatalogCard key={itemKey(item)} item={item} inList={inList.has(itemKey(item))} />
  ));
}

/** Screens 14 and 15. Hero, Continue watching, My List, then curated rows. */
export async function HomeView({ ctx }: { ctx: ViewerContext }) {
  const catalog = getCatalog();
  const library = getLibrary();
  const [home, continueResult, listResult, idsResult] = await Promise.all([
    catalog.home(ctx),
    library.continueWatching(ctx).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    ),
    library.myList(ctx).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    ),
    library.myListIds(ctx).catch(() => [] as string[]),
  ]);

  if (home.empty) {
    return (
      <div className="web-page">
        <h1 className="ad-sr-only">Home</h1>
        <EmptyState
          title="New videos are on the way"
          description="Nothing is published yet. Check back soon."
          action={{ label: 'Browse subjects', href: '/browse' }}
        />
      </div>
    );
  }

  const inList = new Set(idsResult);
  const progress = new Map(
    (continueResult.ok ? continueResult.value : []).map(({ progress: p }) => [p.videoId, p]),
  );

  return (
    <>
      <h1 className="ad-sr-only">Home</h1>
      <Hero items={heroItems(home, progress)} label="Featured" />
      <div className="web-wide web-stack web-rows">
        {continueResult.ok ? (
          continueResult.value.length > 0 ? (
            <ContinueRow items={continueResult.value} />
          ) : null
        ) : (
          <RowError title="Continue watching" />
        )}
        {listResult.ok ? (
          listResult.value.items.length > 0 ? (
            <Row title="My List" seeAllHref="/my-list">
              {cards(listResult.value.items.slice(0, 10), inList)}
            </Row>
          ) : null
        ) : (
          <RowError title="My List" />
        )}
        {home.rows.map((row) => (
          <Row key={row.id} title={row.title} seeAllHref={row.seeAllHref}>
            {cards(row.items, inList)}
          </Row>
        ))}
      </div>
    </>
  );
}

export function HomeSkeleton() {
  return (
    <SkeletonRegion label="Loading Home">
      <div className="web-hero-skeleton" aria-hidden="true" />
      <div className="web-wide web-stack web-rows">
        {[1, 2].map((n) => (
          <div key={n} className="web-rowskel">
            <SkeletonRow />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
