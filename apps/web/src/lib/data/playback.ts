import type {
  CaptionStyle,
  CaptionTrack,
  PlayerChapter,
  PlayerMarkers,
  PlayerPreferences,
  RelatedItem,
  UpNextItem,
} from '@ad/player';

/**
 * Data access for the Watch page (screens 21 and 22). Lane C implements the real service
 * behind this interface. Until then `playback.fixture.ts` answers, so the page and player
 * work end to end with seeded data.
 */

export interface ViewerContext {
  /** Set by the real viewer wiring. Fixtures have no account. */
  accountId?: string;
  profileId: string;
  /** True on a kids profile, or when a guest has Kids mode on. */
  kids: boolean;
  /** A visitor with no account (M40). Never combined with an account id. Progress and preferences stay on the device. */
  guest?: true;
}

export interface WatchSeries {
  id: string;
  title: string;
  /** For example "S1 E4". */
  episodeLabel: string;
  lastEpisode: boolean;
  href: string;
}

export interface WatchVideo {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  posterUrl: string | null;
  categoryLabel: string;
  /** Titles flagged for adults only are blocked on kids profiles. */
  kidsSafe: boolean;
  series: WatchSeries | null;
  backHref: string;
}

export type Tint = 'sky' | 'mint' | 'lemon' | 'peach' | 'lavender';

export interface UpNextTileData {
  id: string;
  title: string;
  tag: string;
  durationLabel: string;
  href: string;
  tint: Tint;
}

export interface NextVideo extends UpNextItem {
  href: string;
}

export interface WatchData {
  video: WatchVideo;
  /** Approved and not yet approved tracks may both be present. The player attaches approved ones only. */
  captions: CaptionTrack[];
  /** Seek preview map. Absent when the video has no sprite sheets. */
  spriteUrl?: string;
  /** Skip windows in seconds (M43). Empty object when none. */
  markers?: PlayerMarkers;
  chapters?: PlayerChapter[];
  saved: { positionSeconds: number; finished: boolean } | null;
  next: NextVideo | null;
  upNext: UpNextTileData[];
  related: RelatedItem[];
  preferences: PlayerPreferences;
  /** Caption size, background and contrast chosen for this profile (M11-S03). */
  captionStyle: CaptionStyle;
  inMyList: boolean;
}

export type WatchLookup =
  { status: 'ok'; data: WatchData } | { status: 'not-found' } | { status: 'kids-blocked' };

export interface PlaybackData {
  getWatchData(videoId: string, viewer: ViewerContext): Promise<WatchLookup>;
}

/** How the browser talks to the playback API. `fixture` needs no server routes. */
export type PlaybackTransport = 'fixture' | 'http';

/**
 * Where watched places go. `http` is the account route, `fixture` the dev only per profile device key, and `local`
 * is the guest store on this device (M40-S04). The session transport and the progress transport are separate
 * because a guest needs the session over http and the place on the device.
 */
export type ProgressTransport = PlaybackTransport | 'local';
