import { Row, SkeletonRegion, SkeletonRow, type HeroItem } from '@ad/ui';
import {
  getCatalog,
  getLibrary,
  getSite,
  type CatalogItem,
  type HomeData,
  type Progress,
  type ViewerContext,
} from '../../lib/data';
import { reloadContinueRowAction, reloadMyListRowAction } from '../../app/actions';
import { itemHref, itemKey, metaLine, timeLeftLabel } from '../../lib/format';
import { CatalogCard, ContinueRow } from '../CatalogCard';
import { RowError } from '../RowError';
import { HomeEmpty } from './HomeEmpty';
import { HomeHero } from './HomeHero';
import { HomeRowsLoader } from './HomeRowsLoader';

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
export async function HomeView({
  ctx,
  dataSaver,
  canUpload,
}: {
  ctx: ViewerContext;
  dataSaver?: boolean;
  canUpload?: boolean;
}) {
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
    const site = await getSite().content();
    return (
      <HomeEmpty
        platformName={site.platformName}
        kids={ctx.audience === 'kids'}
        canUpload={canUpload}
      />
    );
  }

  const inList = new Set(idsResult);
  const progress = new Map(
    (continueResult.ok ? continueResult.value : []).map(({ progress: p }) => [p.videoId, p]),
  );

  return (
    <>
      <h1 className="ad-sr-only">Home</h1>
      <HomeHero
        items={heroItems(home, progress)}
        label="Featured"
        profileId={ctx.guest ? null : ctx.profileId}
        dataSaver={dataSaver}
      />
      <div className="web-wide web-stack web-rows">
        {continueResult.ok ? (
          continueResult.value.length > 0 ? (
            <ContinueRow items={continueResult.value} />
          ) : null
        ) : (
          <RowError title="Continue watching" kind="continue" load={reloadContinueRowAction} />
        )}
        {listResult.ok ? (
          listResult.value.items.length > 0 ? (
            <Row title="My List" seeAllHref="/my-list">
              {cards(listResult.value.items.slice(0, 20), inList)}
            </Row>
          ) : null
        ) : (
          <RowError
            title="My List"
            kind="list"
            seeAllHref="/my-list"
            inList={idsResult}
            load={reloadMyListRowAction}
          />
        )}
        {home.rows.map((row) => (
          <Row key={row.id} title={row.title} seeAllHref={row.seeAllHref}>
            {cards(row.items, inList)}
          </Row>
        ))}
        {home.nextCursor ? (
          <HomeRowsLoader
            initialCursor={home.nextCursor}
            inList={idsResult}
            profileId={ctx.profileId}
          />
        ) : null}
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
