import { classifyConnection, type ConnectionInfo } from './connection';

/** A clip costs a few hundred kilobytes, so it needs a link that is clearly fast. */
export const HERO_PREVIEW_MIN_DOWNLINK_MBPS = 5;

export interface HeroPreviewInput {
  /** Site setting home.hero_previews. */
  enabled: boolean;
  dataSaver: boolean;
  connection: ConnectionInfo;
  /** Site setting home.hero_previews_unknown_connection, for browsers with no Network Information API. */
  allowUnknown: boolean;
  reducedMotion: boolean;
  hidden: boolean;
}

/** Whether the muted hero clip may load now. Re-run on a connection change so a slow link stops it. */
export function heroPreviewEligible(input: HeroPreviewInput): boolean {
  if (!input.enabled || input.dataSaver || input.reducedMotion || input.hidden) return false;
  const kind = classifyConnection(input.connection);
  if (kind === 'unknown') return input.allowUnknown;
  if (kind !== 'fast') return false;
  const down = input.connection.downlinkMbps;
  return down === null || down >= HERO_PREVIEW_MIN_DOWNLINK_MBPS;
}
