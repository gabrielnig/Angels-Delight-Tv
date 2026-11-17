/**
 * Connection and Data saver helpers other lanes import (player, posters, rows, hero).
 * Everything takes a navigator-like argument so it runs on the server, in tests and in the browser.
 */

export type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g';
const EFFECTIVE_TYPES: readonly string[] = ['slow-2g', '2g', '3g', '4g'];

export interface ConnectionLike {
  saveData?: boolean;
  effectiveType?: EffectiveType;
  downlink?: number;
  rtt?: number;
  addEventListener?(type: 'change', listener: () => void): void;
  removeEventListener?(type: 'change', listener: () => void): void;
}

export interface NavigatorLike {
  connection?: ConnectionLike;
}

export interface ConnectionInfo {
  saveData: boolean;
  effectiveType: EffectiveType | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  /** False on browsers without the Network Information API (Safari, Firefox). */
  supported: boolean;
}

export type ConnectionClass = 'slow' | 'medium' | 'fast' | 'unknown';

export function readConnection(nav: NavigatorLike | undefined): ConnectionInfo {
  const connection = nav?.connection;
  if (!connection) {
    return {
      saveData: false,
      effectiveType: null,
      downlinkMbps: null,
      rttMs: null,
      supported: false,
    };
  }
  return {
    saveData: connection.saveData === true,
    effectiveType:
      connection.effectiveType && EFFECTIVE_TYPES.includes(connection.effectiveType)
        ? connection.effectiveType
        : null,
    downlinkMbps: typeof connection.downlink === 'number' ? connection.downlink : null,
    rttMs: typeof connection.rtt === 'number' ? connection.rtt : null,
    supported: true,
  };
}

export function classifyConnection(info: ConnectionInfo): ConnectionClass {
  if (info.saveData) return 'slow';
  switch (info.effectiveType) {
    case 'slow-2g':
    case '2g':
      return 'slow';
    case '3g':
      return 'medium';
    case '4g':
      return 'fast';
    case null:
      break;
  }
  if (info.downlinkMbps !== null) {
    if (info.downlinkMbps < 0.7) return 'slow';
    if (info.downlinkMbps < 2) return 'medium';
    return 'fast';
  }
  return 'unknown';
}

/** First visit default for Data saver (M25-S03 AC2): Save-Data on, or a slow link. */
export function prefersDataSaverByDefault(nav: NavigatorLike | undefined): boolean {
  return classifyConnection(readConnection(nav)) === 'slow';
}

/** Server side: the `Save-Data: on` request header. */
export function requestWantsSaveData(headers: Headers): boolean {
  return headers.get('save-data')?.trim().toLowerCase() === 'on';
}

export interface DataSaverPolicy {
  /** Highest rung the player may pick, null for no cap. */
  maxHeight: number | null;
  heroRotation: boolean;
  hoverPreviews: boolean;
  /** Widest poster variant to request, null for no cap. */
  posterWidth: number | null;
  prefetchNextEpisode: boolean;
}

export const DATA_SAVER_MAX_HEIGHT = 360;
export const DATA_SAVER_POSTER_WIDTH = 320;

/** What Data saver changes (M25-S03 AC1). Pages read one policy object instead of scattering checks. */
export function dataSaverPolicy(dataSaver: boolean): DataSaverPolicy {
  return dataSaver
    ? {
        maxHeight: DATA_SAVER_MAX_HEIGHT,
        heroRotation: false,
        hoverPreviews: false,
        posterWidth: DATA_SAVER_POSTER_WIDTH,
        prefetchNextEpisode: false,
      }
    : {
        maxHeight: null,
        heroRotation: true,
        hoverPreviews: true,
        posterWidth: null,
        prefetchNextEpisode: true,
      };
}

/** Rough data use per minute of video, from the ladder in docs/ARCHITECTURE.md. Shown in settings. */
const MB_PER_MINUTE: Array<[height: number, mb: number]> = [
  [240, 1.5],
  [360, 3],
  [480, 5],
  [720, 9],
  [1080, 15],
];

export function estimateMbPerMinute(height: number): number {
  const rung = MB_PER_MINUTE.find(([rungHeight]) => height <= rungHeight) ?? MB_PER_MINUTE.at(-1)!;
  return rung[1];
}

/** Calls `onChange` when the connection changes. Returns the unsubscribe function. */
export function subscribeConnection(
  nav: NavigatorLike | undefined,
  onChange: (info: ConnectionInfo) => void,
): () => void {
  const connection = nav?.connection;
  if (!connection?.addEventListener || !connection.removeEventListener) return () => undefined;
  const listener = () => onChange(readConnection(nav));
  connection.addEventListener('change', listener);
  return () => connection.removeEventListener?.('change', listener);
}
