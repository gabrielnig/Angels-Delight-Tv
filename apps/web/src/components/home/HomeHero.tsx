'use client';

import { Hero, HERO_ROTATE_MS, type HeroItem } from '@ad/ui';
import { useDataSaver } from '../../lib/lowdata/useDataSaver';

/** Rotates every 10 seconds, except under Data saver (M05-S01 AC2, M25-S03 AC1). Reduced motion is handled by Hero. */
export function HomeHero({
  items,
  label,
  profileId,
  dataSaver,
}: {
  items: HeroItem[];
  label: string;
  profileId: string;
  /** The profile's saved Data saver choice. */
  dataSaver?: boolean;
}) {
  const saver = useDataSaver(profileId, { profileSetting: dataSaver });
  return <Hero items={items} label={label} autoRotateMs={saver.on ? undefined : HERO_ROTATE_MS} />;
}
