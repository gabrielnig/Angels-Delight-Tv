'use client';

import { msg } from '@ad/shared/messages';
import { useEffect, useRef, useState } from 'react';
import type { ActiveMarker } from '../markers';
import { SkipIcon } from './icons';

export const SKIP_IDLE_MS = 8_000;

export interface SkipButtonProps {
  marker: ActiveMarker | null;
  /** Desktop only: show the S key in the button and set aria-keyshortcuts (touch screens have no keys). */
  showKeyHint: boolean;
  /** Changes whenever the viewer moves the pointer or presses a key, so a faded button returns. */
  activity: number;
  onSkip(): void;
}

export function skipLabel(marker: ActiveMarker): string {
  if (marker.nextLesson) return msg('player.skip.next');
  return msg(`player.skip.${marker.kind}` as 'player.skip.intro');
}

/**
 * The Skip intro, Skip recap, Skip credits and Next lesson button (M43-S01 to S03). It fades in with opacity
 * only, stays while the window lasts, fades after 8 seconds without hover or focus and returns on activity.
 * It is rendered before the control bar so it is the first control in Tab order after the video.
 */
export function SkipButton({ marker, showKeyHint, activity, onSkip }: SkipButtonProps) {
  const [visible, setVisible] = useState(true);
  const held = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kind = marker ? `${marker.kind}:${marker.nextLesson}` : null;

  const arm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!held.current) setVisible(false);
    }, SKIP_IDLE_MS);
  };

  useEffect(() => {
    if (kind === null) return;
    setVisible(true);
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [kind, activity]);

  if (!marker) return null;
  const label = skipLabel(marker);

  const hold = (on: boolean) => {
    held.current = on;
    if (on) {
      setVisible(true);
      if (timer.current) clearTimeout(timer.current);
    } else {
      arm();
    }
  };

  return (
    <button
      type="button"
      className="adp-skip"
      data-visible={visible ? 'true' : undefined}
      aria-keyshortcuts={showKeyHint ? 'S' : undefined}
      onClick={onSkip}
      onPointerEnter={() => hold(true)}
      onPointerLeave={() => hold(false)}
      onFocus={() => hold(true)}
      onBlur={() => hold(false)}
    >
      <SkipIcon size={20} />
      <span>{label}</span>
      {showKeyHint ? (
        <span className="adp-skip__key" aria-hidden="true">
          S
        </span>
      ) : null}
    </button>
  );
}
