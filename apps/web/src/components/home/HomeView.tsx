import { msg } from '@ad/shared/messages';
import { Fragment } from 'react';
import { Row, SkeletonRegion, SkeletonRow } from '@ad/ui';
import {
  getCatalog,
  getLibrary,
  getSite,
  type CatalogItem,
  type ViewerContext,
} from '../../lib/data';
import { reloadContinueRowAction, reloadMyListRowAction } from '../../app/actions';
import { itemKey } from '../../lib/format';
import { CatalogCard, ContinueRow } from '../CatalogCard';
import { RowError } from '../RowError';
import { GuestContinueRow } from '../guest/GuestContinueRow';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { SponsorBanner } from '../sponsor/SponsorBanner';
import { bannerIndex } from '../sponsor/banner-position';
import { homeBannerRow, sponsorFor } from '../../server/sponsors/surface-runtime';
import { HomeEmpty } from './HomeEmpty';
import { HomeHero } from './HomeHero';
import { heroItems } from './hero-items';
import { HomeRowsLoader } from './HomeRowsLoader';
import { RANKED_KINDS, RankedRow } from './RankedRow';

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

  const settings = (await themeRuntime()).settings;
  const [
    rotate,
    intervalSeconds,
    maxLoops,
    viewAllLabel,
    previews,
    previewsUnknown,
    minDownlink,
    waitForClip,
    heroSound,
  ] = await Promise.all([
    settings.get('features.autoplay_hero'),
    settings.get('home.hero_interval_seconds'),
    settings.get('home.hero_max_loops'),
    settings.get('home.view_all_label'),
    settings.get('home.hero_previews'),
    settings.get('home.hero_previews_unknown_connection'),
    settings.get('home.hero_previews_min_downlink_mbps'),
    settings.get('home.hero_wait_for_clip'),
    settings.get('home.hero_sound'),
  ]);
  const kidsAudience = ctx.audience === 'kids';
  const [sponsor, afterRow] = kidsAudience
    ? [null, 0]
    : await Promise.all([
        sponsorFor('home_banner', ctx, { saveData: dataSaver === true }),
        homeBannerRow(),
      ]);
  const at = sponsor ? bannerIndex(home.rows.length, afterRow) : -1;
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
        rotate={rotate}
        intervalSeconds={intervalSeconds}
        maxLoops={maxLoops}
        previews={previews}
        allowUnknownConnection={previewsUnknown}
        minDownlinkMbps={minDownlink}
        waitForClip={waitForClip}
        soundAllowed={heroSound && ctx.audience !== 'kids'}
      />
      <div className="web-wide web-stack web-rows">
        {ctx.guest ? <GuestContinueRow /> : null}
        {continueResult.ok ? (
          continueResult.value.length > 0 ? (
            <ContinueRow items={continueResult.value} />
          ) : null
        ) : (
          <RowError title={msg('guest.continue.title')} kind="continue" load={reloadContinueRowAction} />
        )}
        {listResult.ok ? (
          listResult.value.items.length > 0 ? (
            <Row title="My List" viewAllHref="/my-list" viewAllLabel={viewAllLabel}>
              {cards(listResult.value.items.slice(0, 20), inList)}
            </Row>
          ) : null
        ) : (
          <RowError
            title="My List"
            kind="list"
            viewAllHref="/my-list"
            viewAllLabel={viewAllLabel}
            inList={idsResult}
            load={reloadMyListRowAction}
          />
        )}
        {home.rows.map((row, index) => (
          <Fragment key={row.id}>
            {sponsor && index === at ? <SponsorBanner sponsor={sponsor} /> : null}
            {row.kind && RANKED_KINDS.has(row.kind) ? (
              <RankedRow row={row} inList={inList} viewAllLabel={viewAllLabel} />
            ) : (
              <Row
                title={row.title}
                viewAllHref={row.viewAll?.href}
                viewAllExternal={row.viewAll?.external}
                viewAllLabel={viewAllLabel}
              >
                {cards(row.items, inList)}
              </Row>
            )}
          </Fragment>
        ))}
        {sponsor && at === home.rows.length ? <SponsorBanner sponsor={sponsor} /> : null}
        {home.nextCursor ? (
          <HomeRowsLoader
            initialCursor={home.nextCursor}
            inList={idsResult}
            profileId={ctx.profileId}
            viewAllLabel={viewAllLabel}
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
