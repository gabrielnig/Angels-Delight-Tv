'use client';

import { Hero, HERO_ROTATE_MS, type HeroItem } from '@ad/ui';
import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n/provider';
import { ShareHost, useShareEnabled, type ShareTargetInput } from '../share/useShareTarget';
import {
  readConnection,
  subscribeConnection,
  type NavigatorLike,
} from '../../lib/lowdata/connection';
import { heroPreviewEligible } from '../../lib/lowdata/hero-preview';
import { useDataSaver } from '../../lib/lowdata/useDataSaver';

/** `/title/<slug>` and `/series/<slug>` slide links name what the Share sheet shares. */
function shareInputFor(item: HeroItem): ShareTargetInput | null {
  const match = /^\/(title|series)\/([^/?#]+)$/.exec(item.infoHref);
  if (!match) return null;
  return {
    kind: match[1] === 'series' ? 'series' : 'video',
    slug: decodeURIComponent(match[2] as string),
    title: item.title,
    thumbnail: item.image?.src,
  };
}

/** Rotates on the site setting (20 seconds by default, D-351), except under Data saver (M41-S02). Reduced motion is handled by Hero. */
export function HomeHero({
  items,
  label,
  profileId,
  dataSaver,
  rotate = true,
  intervalSeconds = HERO_ROTATE_MS / 1000,
  maxLoops,
  previews = false,
  allowUnknownConnection = false,
  minDownlinkMbps,
  waitForClip = true,
  soundAllowed = false,
}: {
  items: HeroItem[];
  label: string;
  profileId: string | null;
  /** The profile's saved Data saver choice. */
  dataSaver?: boolean;
  /** Site setting features.autoplay_hero. */
  rotate?: boolean;
  /** Site setting home.hero_interval_seconds. */
  intervalSeconds?: number;
  /** Site setting home.hero_max_loops, 0 never stops. */
  maxLoops?: number;
  /** Site setting home.hero_previews. */
  previews?: boolean;
  /** Site setting home.hero_previews_unknown_connection. */
  allowUnknownConnection?: boolean;
  /** Site setting home.hero_previews_min_downlink_mbps. */
  minDownlinkMbps?: number;
  /** Site setting home.hero_wait_for_clip. */
  waitForClip?: boolean;
  /** Site setting home.hero_sound and not a Kids audience. Clips still start muted, the viewer taps to hear them. */
  soundAllowed?: boolean;
}) {
  const t = useT();
  const shareEnabled = useShareEnabled();
  const [sharing, setSharing] = useState<ShareTargetInput | null>(null);
  const saver = useDataSaver(profileId, { profileSetting: dataSaver });
  const previewAllowed = useHeroPreviewAllowed(
    previews,
    saver.on,
    allowUnknownConnection,
    minDownlinkMbps,
  );
  return (
    <>
      <Hero
        items={items}
        label={label}
        intervalMs={saver.on || !rotate ? undefined : intervalSeconds * 1000}
        maxLoops={maxLoops}
        previewAllowed={previewAllowed}
        waitForClip={waitForClip}
        soundAllowed={soundAllowed}
        onShare={shareEnabled ? (item) => setSharing(shareInputFor(item)) : undefined}
        shareLabel={t('share.button')}
      />
      {sharing ? <ShareHost input={sharing} onClose={() => setSharing(null)} /> : null}
    </>
  );
}

/**
 * Whether the muted clip may load. False on the server and first render, then decided in the browser and re-decided
 * when the connection, reduced motion or tab visibility change.
 */
function useHeroPreviewAllowed(
  enabled: boolean,
  dataSaver: boolean,
  allowUnknown: boolean,
  minDownlinkMbps: number | undefined,
) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setAllowed(false);
      return;
    }
    const nav = navigator as NavigatorLike;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const evaluate = () =>
      setAllowed(
        heroPreviewEligible({
          enabled,
          dataSaver,
          connection: readConnection(nav),
          allowUnknown,
          minDownlinkMbps,
          reducedMotion: motion?.matches === true,
          hidden: document.visibilityState === 'hidden',
        }),
      );
    evaluate();
    const stop = subscribeConnection(nav, evaluate);
    motion?.addEventListener?.('change', evaluate);
    document.addEventListener('visibilitychange', evaluate);
    return () => {
      stop();
      motion?.removeEventListener?.('change', evaluate);
      document.removeEventListener('visibilitychange', evaluate);
    };
  }, [enabled, dataSaver, allowUnknown, minDownlinkMbps]);
  return allowed;
}
