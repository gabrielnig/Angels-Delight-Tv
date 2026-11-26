'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '../Button';
import { clock } from './format';
import { useSaveQueue } from './retry-save';

export interface TranscriptCue {
  start: number;
  end: number;
  text: string;
}

const WATCHED_AT = 0.9;
/** A short code for the video that support can ask for. The same video always gives the same code. */
export function videoReference(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `AD-${(h & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

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
  sample = false,
  onWatched,
}: {
  guide: string;
  videoId: string;
  title: string;
  phone: boolean;
  captions: 'track' | 'burned';
  cues: TranscriptCue[];
  watched: boolean;
  /** The live site still plays the placeholder (HELP_MEDIA_RELEASE is `sample`). */
  sample?: boolean;
  onWatched: (guide: string) => Promise<{ ok: boolean }>;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [quality, setQuality] = useState<'720' | '480'>('720');
  const [picture, setPicture] = useState<'desktop' | 'phone'>('desktop');
  const [failed, setFailed] = useState(false);
  const [isWatched, setIsWatched] = useState(watched);
  const [online, setOnline] = useState(true);
  const { save } = useSaveQueue();
  const counted = useRef(watched);

  useEffect(() => {
    setOnline(navigator.onLine !== false);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

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

  // Watched shows at once. A failed save says so in a quiet toast and retries by itself (S198).
  const markWatched = async () => {
    if (counted.current) return;
    counted.current = true;
    setIsWatched(true);
    await save(`watched:${guide}`, () => onWatched(guide));
  };

  const src =
    picture === 'phone' ? `${base(videoId)}-phone-720.mp4` : `${base(videoId)}-${quality}.mp4`;

  return (
    <div className={`hlp-videobox${picture === 'phone' ? ' is-phone' : ''}`}>
      {sample ? (
        <p role="note" className="hlp-videosample">
          <strong>Sample video.</strong> The real recording of this guide is not installed yet.
          Follow the written steps below.
        </p>
      ) : null}
      {online ? (
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
      ) : (
        <div className="hlp-videoerror hlp-videooffline">
          <p>
            <strong>This video needs data</strong>
          </p>
          <p>The steps and the transcript below still work.</p>
        </div>
      )}
      {online && failed ? (
        <div role="alert" className="hlp-videoerror">
          <p>
            <strong>This video could not play</strong>
          </p>
          <p>The steps and transcript below still work.</p>
          <Button
            icon="retry"
            onClick={() => {
              setFailed(false);
              ref.current?.load();
            }}
          >
            Try again
          </Button>
          <p className="hlp-videoref">Reference: {videoReference(videoId)}</p>
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
