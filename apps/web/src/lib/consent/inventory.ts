/**
 * Everything the site keeps on a visitor device, in one typed list (M45-S11, R17, R19, R26). The storage notice,
 * the Privacy page table and the inventory test all read it. Each row names the file that sets it (`source`) and
 * the exact text to find there (`needle`), and each duration is a number taken from the same constant the code
 * uses, so a row cannot drift from the code unnoticed. Nothing here is advertising or tracking from other sites.
 */
export type StorageKind = 'cookie' | 'local' | 'session' | 'cache';
export type StorageType = 'necessary' | 'functional';

export interface StorageItem {
  /** The cookie name, storage key or cache name as it appears in the browser. `<profile>` marks a variable part. */
  name: string;
  store: StorageKind;
  purpose: string;
  /** Plain words for how long it stays. Built from `seconds` when there is one. */
  kept: string;
  seconds?: number;
  type: StorageType;
  /** Staff only rows are not shown on the public Privacy page. */
  audience: 'visitor' | 'staff';
  /** Always true. The inventory test fails for anything else. */
  verified: true;
  /** Repo relative path of the file that sets it, and the text to find there. */
  source: string;
  needle: string;
}

const DAY = 86_400;

/** "10 minutes", "1 day", "180 days", "12 months". */
export function durationText(seconds: number): string {
  if (seconds >= 365 * DAY) {
    const months = Math.round(seconds / (30.4375 * DAY));
    return `${months} months`;
  }
  if (seconds >= DAY) {
    const days = Math.round(seconds / DAY);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

type Row = Omit<StorageItem, 'verified' | 'audience' | 'kept'> & {
  kept: (duration: string) => string;
  audience?: 'visitor' | 'staff';
};

function row(r: Row): StorageItem {
  const { kept, audience, ...rest } = r;
  return {
    ...rest,
    audience: audience ?? 'visitor',
    verified: true,
    kept: kept(r.seconds === undefined ? '' : durationText(r.seconds)),
  };
}

const WEB = 'apps/web/src';

export const STORAGE_INVENTORY: readonly StorageItem[] = [
  row({
    name: '__Host-ad_session',
    store: 'cookie',
    purpose: 'Keeps you signed in.',
    seconds: 30 * DAY,
    kept: (d) => `Until you sign out, or ${d} after your last visit`,
    type: 'necessary',
    source: `${WEB}/server/auth/cookies.ts`,
    needle: '__Host-ad_session',
  }),
  row({
    name: '__Host-ad_pv',
    store: 'cookie',
    purpose: 'Holds your place while you confirm your email address.',
    seconds: 30 * 60,
    kept: (d) => d,
    type: 'necessary',
    source: `${WEB}/server/auth/cookies.ts`,
    needle: '__Host-ad_pv',
  }),
  row({
    name: '__Host-ad_mv',
    store: 'cookie',
    purpose: 'Holds your place between your password and your two step code.',
    seconds: 600,
    kept: (d) => d,
    type: 'necessary',
    source: `${WEB}/server/auth/cookies.ts`,
    needle: '__Host-ad_mv',
  }),
  row({
    name: '__Host-ad_dev',
    store: 'cookie',
    purpose: 'A random number that tells a new device from one you used before, so we can tell you about a new sign in.',
    seconds: 400 * DAY,
    kept: (d) => d,
    type: 'necessary',
    source: `${WEB}/server/auth/cookies.ts`,
    needle: '__Host-ad_dev',
  }),
  row({
    name: '__Host-ad_profile',
    store: 'cookie',
    purpose: 'Remembers which profile is watching on this device.',
    seconds: 30 * DAY,
    kept: (d) => d,
    type: 'functional',
    source: `${WEB}/server/viewer/active-profile.ts`,
    needle: '__Host-ad_profile',
  }),
  row({
    name: 'ad_always_ask',
    store: 'cookie',
    purpose: 'Remembers that you want to be asked who is watching each time.',
    seconds: 365 * DAY,
    kept: (d) => d,
    type: 'functional',
    source: `${WEB}/lib/profiles/always-ask.ts`,
    needle: 'ad_always_ask',
  }),
  row({
    name: 'ad_acct',
    store: 'cookie',
    purpose: 'Lets the profile screen show your saved profile tiles quickly. It holds no password.',
    seconds: 365 * DAY,
    kept: (d) => d,
    type: 'functional',
    source: `${WEB}/lib/profiles/picker-cache.ts`,
    needle: 'ad_acct',
  }),
  row({
    name: '__Host-ad_guest',
    store: 'cookie',
    purpose: 'Lets a visitor without an account resume a video and keeps limits fair. It holds a random number, not your name.',
    seconds: 180 * DAY,
    kept: (d) => d,
    type: 'functional',
    source: `${WEB}/server/guest/guest-cookie.ts`,
    needle: '__Host-ad_guest',
  }),
  row({
    name: '__Host-ad_gaud',
    store: 'cookie',
    purpose: 'Remembers your Kids mode choice on this device when you are not signed in.',
    seconds: 180 * DAY,
    kept: (d) => d,
    type: 'functional',
    source: `${WEB}/server/guest/guest-audience.ts`,
    needle: '__Host-ad_gaud',
  }),
  row({
    name: 'ad_locale',
    store: 'cookie',
    purpose: 'Remembers the language you chose.',
    seconds: 365 * DAY,
    kept: (d) => d,
    type: 'functional',
    source: `${WEB}/lib/i18n/cookie.ts`,
    needle: 'ad_locale',
  }),
  row({
    name: 'ad:guest:progress:v1',
    store: 'local',
    purpose: 'Remembers where you stopped watching when you are not signed in.',
    kept: () => 'Until you clear it. Only your last 100 videos are kept',
    type: 'functional',
    source: `${WEB}/lib/guest/progress-store.ts`,
    needle: 'ad:guest:progress:v1',
  }),
  row({
    name: 'ad:guest:intent:v1',
    store: 'local',
    purpose: 'Remembers a My List or like tap while you sign in, so it is done afterwards.',
    seconds: 30 * 60,
    kept: (d) => d,
    type: 'functional',
    source: `${WEB}/lib/guest/intent.ts`,
    needle: 'ad:guest:intent:v1',
  }),
  row({
    name: 'ad:guest:import-asked',
    store: 'session',
    purpose: 'Remembers that you answered the question about adding this device history to your account.',
    kept: () => 'Until you close the tab',
    type: 'functional',
    source: `${WEB}/components/guest/ImportPrompt.tsx`,
    needle: 'ad:guest:import-asked',
  }),
  row({
    name: 'ad-recent-searches',
    store: 'local',
    purpose: 'Lists your recent searches on this device.',
    kept: () => 'Your last 5, until you clear them. Not kept on Kids profiles',
    type: 'functional',
    source: `${WEB}/components/browse/SearchBox.tsx`,
    needle: 'ad-recent-searches',
  }),
  row({
    name: 'ad:voice:ok',
    store: 'local',
    purpose: 'Remembers that you agreed to use your voice to search.',
    kept: () => 'Until you clear it',
    type: 'functional',
    source: `${WEB}/components/browse/voice.ts`,
    needle: 'ad:voice:ok',
  }),
  row({
    name: 'ad.player.prefs.<profile>',
    store: 'local',
    purpose: 'Remembers your volume, speed, captions and quality choices for each profile.',
    kept: () => 'Until you clear it',
    type: 'functional',
    source: `${WEB}/features/player/preferences.ts`,
    needle: 'ad.player.prefs.',
  }),
  row({
    name: 'ad.player.caption.<profile>',
    store: 'local',
    purpose: 'Remembers how captions look for you.',
    kept: () => 'Until you clear it',
    type: 'functional',
    source: `${WEB}/features/player/preferences.ts`,
    needle: 'ad.player.caption.',
  }),
  row({
    name: 'ad.player.theatre',
    store: 'local',
    purpose: 'Remembers if you chose the wide player layout.',
    kept: () => 'Until you clear it',
    type: 'functional',
    source: `${WEB}/features/player/preferences.ts`,
    needle: 'ad.player.theatre',
  }),
  row({
    name: 'ad:autoplay-streak',
    store: 'session',
    purpose: 'Counts videos that played in a row, so the player can ask if you are still watching.',
    kept: () => 'Until you close the tab',
    type: 'functional',
    source: `${WEB}/features/player/autoplay-streak.ts`,
    needle: 'ad:autoplay-streak',
  }),
  row({
    name: 'ad.bandwidth',
    store: 'local',
    purpose: 'Remembers how fast your connection was, so the next video starts at a sensible quality.',
    kept: () => 'Until you clear it',
    type: 'functional',
    source: 'packages/player/src/bandwidth.ts',
    needle: 'ad.bandwidth',
  }),
  row({
    name: 'ad.datasaver.<profile>',
    store: 'local',
    purpose: 'Remembers your Data saver choice.',
    kept: () => 'Until you clear it or sign out',
    type: 'functional',
    source: `${WEB}/lib/lowdata/preference.ts`,
    needle: 'ad.datasaver.',
  }),
  row({
    name: 'ad.datasaver.told.<profile>',
    store: 'local',
    purpose: 'Remembers that you were told Data saver turned on by itself.',
    kept: () => 'Until you clear it',
    type: 'functional',
    source: `${WEB}/lib/lowdata/useDataSaver.ts`,
    needle: 'ad.datasaver.told.',
  }),
  row({
    name: 'ad.install.v1',
    store: 'local',
    purpose: 'Remembers if you dismissed or used the offer to add the site to your home screen.',
    kept: () => 'Until you clear it',
    type: 'functional',
    source: `${WEB}/lib/pwa/install.ts`,
    needle: 'ad.install.v1',
  }),
  row({
    name: 'ad.writequeue.v1',
    store: 'local',
    purpose: 'Keeps My List and progress changes made while offline until they can be sent. Removed when you sign out.',
    kept: () => 'Until it is sent, or you sign out',
    type: 'functional',
    source: `${WEB}/lib/pwa/write-queue.ts`,
    needle: 'ad.writequeue.v1',
  }),
  row({
    name: 'ad.pendingsignout.v1',
    store: 'local',
    purpose: 'Finishes signing you out when the connection returns, if you signed out while offline.',
    kept: () => 'Until the sign out is finished',
    type: 'necessary',
    source: `${WEB}/lib/pwa/sign-out.ts`,
    needle: 'ad.pendingsignout.v1',
  }),
  row({
    name: 'ad.pickercache.v1',
    store: 'local',
    purpose: 'Draws your profile tiles at once on the profile screen. Removed when you sign out.',
    seconds: 7 * DAY,
    kept: (d) => `Up to ${d}, or until you sign out`,
    type: 'functional',
    source: `${WEB}/lib/profiles/picker-cache.ts`,
    needle: 'ad.pickercache.v1',
  }),
  row({
    name: 'ad:notice:v1',
    store: 'local',
    purpose: 'Remembers that you closed the storage notice.',
    seconds: 365 * DAY,
    kept: (d) => `${d}, or until the notice changes`,
    type: 'functional',
    source: `${WEB}/lib/consent/notice.ts`,
    needle: 'ad:notice:v1',
  }),
  row({
    name: 'ad-static-<version>',
    store: 'cache',
    purpose: 'Keeps the pages and files the site needs so it opens fast and works offline.',
    kept: () => 'Until the site updates',
    type: 'functional',
    source: `${WEB}/lib/pwa/sw-source.ts`,
    needle: "'ad-static-'",
  }),
  row({
    name: 'ad-img-v1',
    store: 'cache',
    purpose: 'Keeps recently seen pictures so they load again quickly.',
    kept: () => 'Until you clear it. Only the latest 120 pictures are kept',
    type: 'functional',
    source: `${WEB}/lib/pwa/sw-source.ts`,
    needle: 'ad-img-v1',
  }),
  row({
    name: 'ad-pages-v1',
    store: 'cache',
    purpose: 'Keeps pages you opened so they can show when you are offline. Removed when you sign out.',
    kept: () => 'Until you sign out or clear it',
    type: 'functional',
    source: `${WEB}/lib/pwa/sw-source.ts`,
    needle: 'ad-pages-v1',
  }),
  row({
    name: 'ad.upload.<file>',
    store: 'local',
    purpose: 'Lets staff resume an interrupted video upload.',
    kept: () => 'Until the upload finishes',
    type: 'functional',
    audience: 'staff',
    source: `${WEB}/components/admin/UploaderContext.tsx`,
    needle: 'ad.upload.',
  }),
];

export function visitorInventory(): StorageItem[] {
  return STORAGE_INVENTORY.filter((item) => item.audience === 'visitor');
}
