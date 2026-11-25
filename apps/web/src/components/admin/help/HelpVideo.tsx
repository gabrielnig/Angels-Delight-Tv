'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '../Button';
import { clock } from './format';

export interface TranscriptCue {
  start: number;
  end: number;
  text: string;
}

const WATCHED_AT = 0.9;
const base = (id: string) => `/admin/help/media/video/${id}/${id}`;

/**
 * The silent help video (M50-S06): a native player with captions, a poster, no autoplay and no loop. The file loads
 * only on Play. A transcript lists every caption and jumps the video. Watched counts at 90 percent or by button.
 */
export function HelpVideo({
  guide,
  videoId,
  title,
  phone,
  captions,
  cues,
  watched,
  onWatched,
}: {
  guide: string;
  videoId: string;
  title: string;
  phone: boolean;
  captions: 'track' | 'burned';
  cues: TranscriptCue[];
  watched: boolean;
  onWatched: (guide: string) => Promise<{ ok: boolean }>;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [quality, setQuality] = useState<'720' | '480'>('720');
  const [picture, setPicture] = useState<'desktop' | 'phone'>('desktop');
  const [failed, setFailed] = useState(false);
  const [isWatched, setIsWatched] = useState(watched);
  const [saveFailed, setSaveFailed] = useState(false);
  const counted = useRef(watched);

  // Data saver and small screens start on the small file and the phone picture (M50-S06 AC2, S11 AC2).
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData;
    const narrow =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 37.4375rem)').matches;
    if (saveData || narrow) setQuality('480');
    if (phone && narrow) setPicture('phone');
  }, [phone]);

  const markWatched = async () => {
    if (counted.current) return;
    counted.current = true;
    let result: { ok: boolean };
    try {
      result = await onWatched(guide);
    } catch {
      result = { ok: false };
    }
    if (result.ok) setIsWatched(true);
    else {
      counted.current = false;
      setSaveFailed(true);
    }
  };

  const src =
    picture === 'phone' ? `${base(videoId)}-phone-720.mp4` : `${base(videoId)}-${quality}.mp4`;

  return (
    <div className={`hlp-videobox${picture === 'phone' ? ' is-phone' : ''}`}>
      <video
        key={src}
        ref={ref}
        className="hlp-player"
        controls
        playsInline
        preload="none"
        poster={`${base(videoId)}-poster.webp`}
        src={src}
        aria-label={title}
        onError={() => setFailed(true)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration > 0 && v.currentTime / v.duration >= WATCHED_AT) void markWatched();
        }}
      >
        {captions === 'track' ? (
          <track
            kind="captions"
            srcLang="en"
            label="English"
            src={`${base(videoId)}-captions.vtt`}
            default
          />
        ) : null}
      </video>
      {failed ? (
        <div role="alert" className="hlp-videoerror">
          <p>The video did not load. The words are below.</p>
          <Button
            icon="retry"
            onClick={() => {
              setFailed(false);
              ref.current?.load();
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}
      <div className="hlp-videobar">
        <label>
          <span>Quality</span>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as '720' | '480')}
            aria-label="Quality"
          >
            <option value="720">Standard</option>
            <option value="480">Data saver</option>
          </select>
        </label>
        {phone ? (
          <label>
            <span>Picture</span>
            <select
              value={picture}
              onChange={(e) => setPicture(e.target.value as 'desktop' | 'phone')}
              aria-label="Picture"
            >
              <option value="desktop">Desktop</option>
              <option value="phone">Phone</option>
            </select>
          </label>
        ) : null}
        {isWatched ? (
          <span className="hlp-watched">Watched</span>
        ) : (
          <Button onClick={() => void markWatched()}>Mark as watched</Button>
        )}
        <span className="hlp-videonote">No sound is needed. Captions are on.</span>
      </div>
      {saveFailed ? <p role="alert">We could not save that. Try again.</p> : null}
      <details className="hlp-transcript" open={failed || undefined}>
        <summary>Read this video</summary>
        <ol>
          {cues.map((cue) => (
            <li key={cue.start}>
              <button
                type="button"
                onClick={() => {
                  if (ref.current) ref.current.currentTime = cue.start;
                }}
              >
                <span className="hlp-transcript__time">{clock(Math.floor(cue.start))}</span>{' '}
                {cue.text}
              </button>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
