'use client';

import { Hero, HERO_ROTATE_MS, type HeroItem } from '@ad/ui';
import { useDataSaver } from '../../lib/lowdata/useDataSaver';

/** Rotates on the site setting (10 seconds by default), except under Data saver (M41-S02). Reduced motion is handled by Hero. */
export function HomeHero({
  items,
  label,
  profileId,
  dataSaver,
  rotate = true,
  intervalSeconds = HERO_ROTATE_MS / 1000,
  maxLoops,
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
}) {
  const saver = useDataSaver(profileId, { profileSetting: dataSaver });
  return (
    <Hero
      items={items}
      label={label}
      intervalMs={saver.on || !rotate ? undefined : intervalSeconds * 1000}
      maxLoops={maxLoops}
    />
  );
}
