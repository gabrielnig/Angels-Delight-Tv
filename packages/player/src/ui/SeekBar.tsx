'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { chapterAt, chapterTicks, normalizeChapters, type PlayerChapter } from '../chapters';
import { formatClock, seekValueText } from '../format';
import { SpriteLoader, findTile, type SpriteTile } from '../sprite';

export interface SeekBarProps {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  onSeek(seconds: number): void;
  /** Seek preview map. Leave it out (null) with Data saver on: nothing is downloaded (M08-S29). */
  spriteUrl?: string | null | undefined;
  /** Chapters (M43): gaps in the rail, the title in the tooltip and in aria-valuetext. */
  chapters?: readonly PlayerChapter[] | undefined;
  /** Test seam. */
  fetcher?: (url: string) => Promise<Response>;
}

/**
 * Seek slider. 5px rail growing to 8px on hover, drag and focus, with a 44px tall hit area so a thumb
 * does not need precision (M08-S09). Left and Right are handled by the player keyboard map.
 */
export function SeekBar({
  currentTime,
  duration,
  bufferedEnd,
  onSeek,
  spriteUrl,
  chapters,
  fetcher,
}: SeekBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const known = Number.isFinite(duration) && duration > 0;
  const loader = useRef<SpriteLoader | null>(null);
  const [tiles, setTiles] = useState<SpriteTile[]>([]);

  useEffect(() => {
    loader.current = null;
    setTiles([]);
  }, [spriteUrl]);

  // The map is fetched on the first hover or touch, never on page load.
  const wake = () => {
    if (!spriteUrl || loader.current) return;
    const l = new SpriteLoader(spriteUrl, fetcher);
    loader.current = l;
    void l.load().then(() => {
      if (loader.current === l) setTiles(l.tiles);
    });
  };

  const timeAt = (clientX: number): { x: number; t: number } => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || !known) return { x: 0, t: 0 };
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return { x: f * rect.width, t: f * duration };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!known) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    wake();
    const p = timeAt(e.clientX);
    setHover(p);
    onSeek(p.t);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!known) return;
    wake();
    const p = timeAt(e.clientX);
    setHover(p);
    if (dragging) onSeek(p.t);
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragging(false);
    if (e.pointerType !== 'mouse') setHover(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Handled by the player level keyboard map so the slider and shortcuts never disagree.
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation();
    if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5));
    if (e.key === 'ArrowRight') onSeek(currentTime + 5);
  };

  const list = normalizeChapters(chapters, duration);
  const ticks = chapterTicks(list, duration);
  const hoverChapter = hover ? chapterAt(list, hover.t) : null;
  const currentChapter = chapterAt(list, currentTime);
  const tile = hover ? findTile(tiles, hover.t) : null;
  const railWidth = ref.current?.getBoundingClientRect().width ?? 0;
  const half = tile ? tile.width / 2 : 0;
  // Without a preview tile the tip is as wide as its chapter title, up to 160px (see .adp-seek__tip-chapter).
  const tipHalf = half > 0 ? half : hoverChapter ? 80 : 0;
  const tipLeft = hover
    ? railWidth > 0 && tipHalf > 0
      ? Math.min(Math.max(hover.x, tipHalf), railWidth - tipHalf)
      : hover.x
    : 0;
  const played = known ? Math.min(100, (currentTime / duration) * 100) : 0;
  const buffered = known ? Math.min(100, (bufferedEnd / duration) * 100) : 0;

  return (
    <div
      ref={ref}
      className="adp-seek"
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={known ? Math.round(duration) : 0}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={
        currentChapter
          ? `${seekValueText(currentTime, duration)}, chapter ${currentChapter.title}`
          : seekValueText(currentTime, duration)
      }
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => !dragging && setHover(null)}
      onKeyDown={onKeyDown}
    >
      <div className="adp-seek__body">
        <div className="adp-seek__rail">
          <div className="adp-seek__buffered" style={{ width: `${buffered}%` }} />
          <div className="adp-seek__played" style={{ width: `${played}%` }} />
        </div>
        {ticks.map((fraction) => (
          <span
            key={fraction}
            className="adp-seek__tick"
            style={{ left: `${fraction * 100}%` }}
            aria-hidden="true"
          />
        ))}
        <div className="adp-seek__thumb" style={{ left: `${played}%` }} />
      </div>
      {hover ? (
        <div
          className={tile ? 'adp-seek__tip adp-seek__tip--preview' : 'adp-seek__tip'}
          style={{ left: tipLeft }}
          aria-hidden="true"
        >
          {tile ? (
            <div className="adp-seek__preview">
              <div
                className="adp-seek__preview-img"
                style={{
                  width: `${tile.width}px`,
                  height: `${tile.height}px`,
                  backgroundImage: `url("${tile.url}")`,
                  backgroundPosition: `-${tile.x}px -${tile.y}px`,
                }}
              />
            </div>
          ) : null}
          {hoverChapter ? <span className="adp-seek__tip-chapter">{hoverChapter.title}</span> : null}
          {formatClock(hover.t)}
        </div>
      ) : null}
    </div>
  );
}
