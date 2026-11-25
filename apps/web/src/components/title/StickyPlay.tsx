'use client';

import { ButtonLink } from '@ad/ui';
import type { PrimaryAction } from '../../lib/title-cta';
import { useGuestPrimary, type GuestPlace } from './useGuestPrimary';
import './title.css';

/**
 * The Play bar that sticks to the bottom of a phone (M07). It has the same destination and words as the main
 * button, so a guest sees Resume or Play next from this device here too (M51-S06).
 */
export function StickyPlay({ primary, guest }: { primary: PrimaryAction; guest?: GuestPlace }) {
  const shown = useGuestPrimary(primary, guest);
  return (
    <div className="tv-sticky">
      <ButtonLink href={shown.href} icon="play" size="lg" fullWidth>
        {shown.text}
      </ButtonLink>
    </div>
  );
}
