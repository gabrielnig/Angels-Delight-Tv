/**
 * Viewer data contracts. Pages and components depend on these interfaces only.
 * Fixture implementations live in ./fixtures. The integration pass swaps them for the real services
 * (lane B auth, lane C viewer API) without touching pages.
 */

import type { SeriesLabelSetting } from '@ad/shared/series-labels';

export type Audience = 'adult' | 'kids';

export interface Thumb {
  src: string;
  /** Alt text of the artwork when the editor wrote one. */
  alt?: string;
  srcSet?: string;
  /** jpeg copy for browsers that cannot read webp. */
  fallbackSrc?: string;
  fallbackSrcSet?: string;
  /** Tiny webp data url drawn blurred while the image loads (M36-S02). */
  placeholderBlur?: string;
  /** Hex colour drawn while the image loads when there is no blur. */
  placeholderColor?: string;
}

export interface Profile {
  id: string;
  name: string;
  kids: boolean;
  /** Pastel avatar tone name, one of sky, mint, lemon, peach, lavender. */
  tone?: string;
  /** Illustrated avatar id (M03-S03), one of the twelve in @ad/ui AVATAR_ART_IDS. */
  avatarId?: string;
  /** Adult profiles can manage the account. */
  owner: boolean;
  language: string;
  autoplayNext: boolean;
  lastUsedHere?: boolean;
  /** A four digit PIN guards this profile (M03-S12). The PIN itself never leaves the server. */
  hasPin?: boolean;
  /** The profile's saved Data saver choice (M03-S09). */
  dataSaver?: boolean;
  /** Highest maturity rank this profile may watch, 0 (G) to 4 (18). Kids profiles are 0 (M44-S19). */
  maxMaturityRank?: number;
}

export interface ViewerSession {
  accountId: string;
  email: string;
  displayName: string;
  verified: boolean;
  memberSince: string;
  profile: Profile | null;
  /** The account can add videos, so Home can offer it when the catalog is empty. */
  canUpload?: boolean;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
}

export interface VideoSummary {
  kind: 'video';
  id: string;
  slug: string;
  title: string;
  description: string;
  durationSeconds: number;
  categorySlug: string;
  categoryName: string;
  thumbnail?: Thumb;
  hasCaptions: boolean;
  ageLabel?: string;
  kidsSafe: boolean;
  /** ISO date. */
  publishedAt: string;
  series?: {
    slug: string;
    title: string;
    season: number;
    episode: number;
    labels?: SeriesLabelSetting;
  };
  /** This profile's rating (-1 Not for me, 1 Like, 2 Love), null when unrated, absent when the source has none (M44). */
  rating?: -1 | 1 | 2 | null;
  /** The computed Most liked label (M44-S05). */
  mostLiked?: boolean;
  /** 0 (G) to 4 (18), null until rated (M44-S13). Cards hide G, the title page shows every rating. */
  maturityRank?: number | null;
}

export interface SeriesSummary {
  kind: 'series';
  /** Set by the real catalog. Fixtures have none and use the slug as the key. */
  id?: string;
  slug: string;
  title: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  thumbnail?: Thumb;
  episodeCount: number;
  seasonCount: number;
  /** The group and item words of this series (M51). Absent means Season and Episode. */
  labels?: SeriesLabelSetting;
  kidsSafe: boolean;
  ageLabel?: string;
  hasCaptions: boolean;
  publishedAt: string;
  rating?: -1 | 1 | 2 | null;
  mostLiked?: boolean;
  maturityRank?: number | null;
}

export type CatalogItem = VideoSummary | SeriesSummary;

export interface Progress {
  videoId: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: string;
  /** True for the next episode after a finished one, not yet started. */
  nextUp?: boolean;
  /** "S1 E4" for an episode. */
  episodeLabel?: string | null;
}

export interface HeroSlot {
  item: CatalogItem;
  /** Optional curated line, otherwise the item description is used. */
  blurb?: string;
  /** Editor headline, otherwise the item title (M41-S10). */
  headline?: string;
  /** Editor Play label, otherwise Play. */
  buttonLabel?: string;
  /** Muted clip, present only when it is ready and not turned off (M41-S11). */
  previewUrl?: string;
  previewMs?: number;
  /** The clip has a sound track (new clips only). Absent means silent. */
  previewHasAudio?: boolean;
}

export interface HomeRow {
  id: string;
  /** The row kind when it matters to the drawing: trending, top_ten and most_liked (M44-S07, S09, S10). */
  kind?: string;
  title: string;
  /** Where View all goes. Absent means no link (M41-S08). */
  viewAll?: { href: string; external: boolean };
  items: CatalogItem[];
}

export interface HomeData {
  hero: HeroSlot[];
  rows: HomeRow[];
  /** True when nothing is published for this audience. */
  empty: boolean;
  /** Set when more rows wait below the first screen (M05-S04). */
  nextCursor?: string | null;
}

export interface HomeRowsPage {
  rows: HomeRow[];
  nextCursor: string | null;
}

export type BrowseSort = 'newest' | 'shortest' | 'longest' | 'az';
export type BrowseLength = 'any' | 'short' | 'medium' | 'long';

export interface BrowseQuery {
  categorySlug?: string;
  length?: BrowseLength;
  sort?: BrowseSort;
  cursor?: string;
  limit?: number;
}

export type ListKind = 'new' | 'trending' | 'series' | 'row';

export interface ListQuery {
  list: ListKind;
  slug?: string;
  cursor?: string;
}

export interface ListPage extends Page<CatalogItem> {
  title: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

export type Suggestion =
  | { type: 'video'; label: string; href: string }
  | { type: 'category'; label: string; href: string };

export interface TitleDetail {
  video: VideoSummary;
  longDescription: string;
  credits?: string;
  related: VideoSummary[];
  progress?: Progress;
  /** What the main button does for this profile (M07-S03). */
  play: { label: 'play' | 'resume' | 'watch_again'; startSeconds: number };
}

export interface Episode {
  video: VideoSummary;
  number: number;
  blurb: string;
  progress?: Progress;
  watched: boolean;
  /** The episode the main button opens. The list highlights it. */
  current: boolean;
}

export interface SeriesDetail {
  series: SeriesSummary;
  seasons: Array<{ number: number; title?: string | null; episodes: Episode[] }>;
  /** Episode to resume or start. */
  next: {
    videoId: string;
    season: number;
    episode: number;
    resume: boolean;
    secondsLeft?: number;
    label: 'play' | 'resume' | 'watch_again';
  };
}

export interface ViewerContext {
  accountId: string;
  profileId: string;
  audience: Audience;
  /**
   * A visitor with no account (M40). `accountId` is empty and `profileId` is `none`, so a guest context can never
   * name an account or a profile. The real services answer from the audience alone and read no personal table.
   */
  guest?: true;
}

/** The context for a guest. Only the audience is meaningful. */
export function guestContext(audience: Audience): ViewerContext {
  return { accountId: '', profileId: 'none', audience, guest: true };
}

/** A page of search results with the notes the screen shows above them (M45). */
export interface SearchPage extends Page<CatalogItem> {
  subjects?: { slug: string; name: string }[];
  /** The spelling the results are for, when it differs from what was typed. */
  showingFor?: string | null;
  didYouMean?: string | null;
}

export interface CatalogRepository {
  home(ctx: ViewerContext): Promise<HomeData>;
  /** The next page of rows below the first screen. */
  homeRows(ctx: ViewerContext, cursor: string): Promise<HomeRowsPage>;
  categories(ctx: ViewerContext): Promise<Category[]>;
  browse(ctx: ViewerContext, query: BrowseQuery): Promise<Page<CatalogItem>>;
  /** A View all list page. Null when the list is unknown or not open to this audience (the route is a 404). */
  browseList(ctx: ViewerContext, query: ListQuery): Promise<ListPage | null>;
  search(
    ctx: ViewerContext,
    q: string,
    cursor?: string,
    options?: { exact?: boolean },
  ): Promise<SearchPage>;
  suggest(ctx: ViewerContext, q: string): Promise<Suggestion[]>;
  popular(ctx: ViewerContext): Promise<VideoSummary[]>;
  /**
   * null when the title is missing, unpublished or not allowed for the audience. `redirect` is a path when the
   * slug moved or belongs to an episode (the page redirects to it).
   */
  title(
    ctx: ViewerContext,
    slug: string,
  ): Promise<TitleDetail | { blocked: 'kids' } | { redirect: string } | null>;
  /** Public preview for signed out visitors. */
  publicTitle(slug: string): Promise<VideoSummary | null>;
  /**
   * Public preview of a video or a series, or where an old address now lives. Draft, hidden and missing titles are
   * all null, so a visitor cannot tell them apart.
   */
  publicPreview(slug: string, kind: 'video' | 'series'): Promise<PublicPreview | null>;
  series(
    ctx: ViewerContext,
    slug: string,
  ): Promise<SeriesDetail | { blocked: 'kids' } | { redirect: string } | null>;
}

/** The editor's own words for the share card, from the title editor (L15b). */
export interface ShareWords {
  title: string | null;
  description: string | null;
}

export type PublicPreview =
  | { type: 'video'; item: VideoSummary; share?: ShareWords }
  | { type: 'series'; item: SeriesSummary; share?: ShareWords }
  | { type: 'redirect'; to: string };

/** One title in Viewing activity (M49-S09). Mirrors `ActivityItem` in @ad/viewer. */
export interface ActivityEntry {
  videoId: string;
  title: string;
  seriesTitle: string | null;
  episodeLabel: string | null;
  slug: string;
  posterUrl: string | null;
  posterAlt: string | null;
  /** ISO time of the last watch. */
  watchedAt: string;
  completed: boolean;
  progressPct: number;
}

export interface ActivityPageData {
  items: ActivityEntry[];
  nextCursor: string | null;
}

export interface LibraryRepository {
  /** Titles the profile in `ctx` watched, newest first (M49-S09). */
  activity(ctx: ViewerContext, cursor?: string): Promise<ActivityPageData>;
  removeActivity(ctx: ViewerContext, videoId: string): Promise<void>;
  clearActivity(ctx: ViewerContext): Promise<{ cleared: number }>;
  myList(
    ctx: ViewerContext,
    cursor?: string,
    options?: {
      filter?: 'all' | 'started' | 'not_started';
      sort?: 'newest' | 'oldest' | 'az' | 'za';
    },
  ): Promise<
    Page<CatalogItem> & {
      hiddenCount: number;
      /** Filter chip counts. Absent when the source cannot tell. */
      counts?: { all: number; started: number; notStarted: number };
    }
  >;
  myListIds(ctx: ViewerContext): Promise<string[]>;
  addToList(ctx: ViewerContext, itemKey: string): Promise<void>;
  removeFromList(ctx: ViewerContext, itemKey: string): Promise<void>;
  continueWatching(ctx: ViewerContext): Promise<Array<{ video: VideoSummary; progress: Progress }>>;
  removeFromContinue(ctx: ViewerContext, videoId: string): Promise<void>;
  restoreContinue(ctx: ViewerContext, videoId: string): Promise<void>;
}

export type AuthFailure =
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'locked'; minutes: number }
  | { ok: false; reason: 'rate_limited'; minutes: number }
  | { ok: false; reason: 'unavailable' }
  | { ok: false; reason: 'network' }
  | { ok: false; reason: 'check_required' };

export type AuthResult = { ok: true; next: string } | AuthFailure;

export type CodeFailure =
  | { ok: false; reason: 'wrong'; triesLeft?: number }
  | { ok: false; reason: 'expired' }
  | { ok: false; reason: 'too_many'; minutes: number }
  | { ok: false; reason: 'resend_limit' }
  | { ok: false; reason: 'network' };

export type CodeResult = { ok: true; next: string } | CodeFailure;

export type SignUpResult =
  | { ok: true; next: string }
  | {
      ok: false;
      reason:
        | 'rate_limited'
        | 'network'
        | 'invite_required'
        | 'invalid_email'
        | 'weak_password'
        | 'check_required';
    };

/** The second step of a viewer sign in (M49-S02). One problem each, and a session only on success. */
export type TwoStepResult =
  | { ok: true; next: string }
  | { ok: false; reason: 'wrong' | 'expired' | 'network' }
  | { ok: false; reason: 'locked'; minutes: number };

export interface AuthGateway {
  signIn(input: {
    email: string;
    password: string;
    next?: string;
    challengeToken?: string;
  }): Promise<AuthResult>;
  signUp(input: {
    email: string;
    password: string;
    inviteCode?: string;
    challengeToken?: string;
  }): Promise<SignUpResult>;
  verifyEmail(input: { code: string }): Promise<CodeResult>;
  /** The authenticator code step after a correct password (M49-S02). */
  verifyTwoStep(input: { code: string; next?: string }): Promise<TwoStepResult>;
  /** The same step with a single use recovery code (M49-S03). */
  verifyRecovery(input: { code: string; next?: string }): Promise<TwoStepResult>;
  /** True while a correct password is waiting for its code, so the challenge page knows whether to show. */
  hasTwoStepPending(): Promise<boolean>;
  /** The address waiting for a verification code (set by sign up or sign in), or null. */
  pendingEmail(): Promise<string | null>;
  resendCode(): Promise<{ ok: true } | { ok: false; reason: 'resend_limit' | 'network' }>;
  requestPasswordReset(input: {
    email: string;
  }): Promise<{ ok: true } | { ok: false; reason: 'rate_limited' | 'network' }>;
  resetPassword(input: {
    token: string;
    password: string;
  }): Promise<{ ok: true } | { ok: false; reason: 'expired' | 'weak_password' | 'network' }>;
  confirmEmailLink(token: string): Promise<'confirmed' | 'used' | 'expired'>;
  signOut(): Promise<void>;
  /** Re-checks the account password, used by the Kids exit gate. */
  checkPassword(
    password: string,
  ): Promise<
    | { ok: true }
    | { ok: false; reason: 'wrong'; triesLeft: number }
    | { ok: false; reason: 'locked'; minutes: number }
  >;
}

export interface ProfileInput {
  name: string;
  kids: boolean;
  tone?: string;
  avatarId?: string;
  language?: string;
  autoplayNext?: boolean;
  /** Four digits to set, or null to remove. Needs the account password. */
  pin?: string | null;
  /** 0 (G) to 4 (18). Raising it needs the account password. Kids profiles stay at 0 (M44-S19). */
  maxMaturityRank?: number;
}

export type ProfileFailure = 'duplicate' | 'limit' | 'last_adult' | 'password_required' | 'network';

export interface ProfilesRepository {
  list(accountId: string): Promise<Profile[]>;
  get(accountId: string, id: string): Promise<Profile | null>;
  create(
    accountId: string,
    input: ProfileInput,
  ): Promise<{ ok: true; profile: Profile } | { ok: false; reason: ProfileFailure }>;
  update(
    accountId: string,
    id: string,
    input: Partial<ProfileInput> & { password?: string },
  ): Promise<{ ok: true; profile: Profile } | { ok: false; reason: ProfileFailure }>;
  remove(
    accountId: string,
    id: string,
  ): Promise<{ ok: true } | { ok: false; reason: ProfileFailure }>;
  select(
    accountId: string,
    id: string,
    proof?: { pin?: string; password?: string },
  ): Promise<SelectProfileResult>;
  maxProfiles: number;
}

export type SelectProfileResult =
  | { ok: true }
  | { ok: false; reason: 'pin_required' | 'pin_invalid' | 'password_incorrect' }
  | { ok: false; reason: 'locked'; minutes: number };

export interface PlaybackSettings {
  autoplayNext: boolean;
  /** A short silent preview on Home when a title is hovered or paused on. Off by default (S29). */
  autoplayPreviews: boolean;
  dataSaver: boolean;
  quality: 'auto' | '1080' | '720' | '480' | '360';
  speed: number;
  captionsDefault: boolean;
  captionSize: 'small' | 'medium' | 'large' | 'xlarge';
  captionBackground: 'none' | 'dark' | 'solid';
  captionContrast: 'standard' | 'high';
  captionEdge: 'none' | 'shadow' | 'outline';
  /** Caption text colour. Yellow needs a background or high contrast (M49-S11). */
  captionColor: 'white' | 'yellow';
  /** Default caption language, a code such as en or yo. */
  captionLanguage: string;
}

export type DeviceKind = 'phone' | 'tablet' | 'tv' | 'computer' | 'other';

export interface DeviceSession {
  id: string;
  label: string;
  place: string;
  lastActive: string;
  current: boolean;
  /** Picks the icon. Missing means the label decides. */
  kind?: DeviceKind;
}

/** One row of the recent sign ins list (M49-S14). Country only, never an address. */
export interface LoginHistoryEntry {
  id: string;
  when: string;
  outcome: 'success' | 'failed' | 'mfa_failed' | 'locked';
  place: string;
  deviceLabel: string;
  device: DeviceKind;
  newDevice: boolean;
}

export interface ExportState {
  status: 'none' | 'pending' | 'ready' | 'failed';
  requestedAt?: string;
  fileName?: string;
  sizeLabel?: string;
  expiresLabel?: string;
  downloadHref?: string;
}

export interface AccountOverview {
  displayName: string;
  email: string;
  verified: boolean;
  memberSince: string;
  watchedThisMonth: number;
  minutesLearning: number;
  myListCount: number;
  devices: number;
  /** When the password last changed, for example "12 Aug 2026". */
  passwordChanged: string;
}

export type EmailChangeFailure = 'wrong_password' | 'invalid_email' | 'same_email' | 'network';

export interface TwoFactorState {
  enabled: boolean;
  recoveryRemaining: number;
  /** Two or fewer codes left. */
  low: boolean;
}

export type TwoFactorProblem =
  { ok: false; reason: 'network' } | { ok: false; reason: 'locked'; minutes: number };

export interface AccountRepository {
  twoFactor(accountId: string): Promise<TwoFactorState>;
  /** Starts setup: a manual key, an authenticator link and a QR picture. Nothing is on until confirmed. */
  beginTwoFactor(
    accountId: string,
  ): Promise<
    { ok: true; secret: string; uri: string; qrSvg: string } | { ok: false; reason: 'network' }
  >;
  confirmTwoFactor(
    accountId: string,
    input: { code: string },
  ): Promise<
    { ok: true; recoveryCodes: string[] } | { ok: false; reason: 'wrong' } | TwoFactorProblem
  >;
  disableTwoFactor(
    accountId: string,
    input: { password: string; code: string },
  ): Promise<
    { ok: true } | { ok: false; reason: 'wrong_password' | 'wrong_code' } | TwoFactorProblem
  >;
  regenerateRecoveryCodes(
    accountId: string,
    input: { password: string },
  ): Promise<
    | { ok: true; recoveryCodes: string[] }
    | { ok: false; reason: 'wrong_password' }
    | TwoFactorProblem
  >;
  overview(accountId: string): Promise<AccountOverview>;
  /** Saves the name shown on the account screen (S27 Edit name). */
  updateName(
    accountId: string,
    name: string,
  ): Promise<{ ok: true; name: string } | { ok: false; reason: 'invalid' | 'network' }>;
  /** Starts an email change: a 6 digit code goes to the new address. Needs the account password (M02-S02). */
  requestEmailChange(
    accountId: string,
    input: { newEmail: string; password: string },
  ): Promise<{ ok: true; pendingEmail: string } | { ok: false; reason: EmailChangeFailure }>;
  confirmEmailChange(
    accountId: string,
    input: { code: string },
  ): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'too_many' | 'network' }>;
  playback(profileId: string): Promise<PlaybackSettings>;
  savePlayback(profileId: string, patch: Partial<PlaybackSettings>): Promise<PlaybackSettings>;
  /** One time move of choices an older version kept in this browser. Later calls change nothing. */
  migrateDevicePlayback(
    profileId: string,
    legacy: Record<string, unknown>,
  ): Promise<PlaybackSettings>;
  devices(accountId: string): Promise<DeviceSession[]>;
  revokeDevice(accountId: string, id: string): Promise<void>;
  revokeOtherDevices(accountId: string): Promise<number>;
  /** Ends every session including this one, after the password is confirmed (M49-S12). */
  signOutEverywhere(
    accountId: string,
    password: string,
  ): Promise<
    | { ok: true }
    | { ok: false; reason: 'wrong_password' | 'network' }
    | { ok: false; reason: 'locked'; minutes: number }
  >;
  /** The last 20 sign in attempts, newest first (M49-S14). */
  loginHistory(accountId: string): Promise<LoginHistoryEntry[]>;
  changePassword(
    accountId: string,
    input: { current: string; next: string },
  ): Promise<
    | { ok: true; signedOutDevices: number }
    | { ok: false; reason: 'wrong_current' | 'weak' | 'network' }
  >;
  exportState(accountId: string): Promise<ExportState>;
  requestExport(
    accountId: string,
    input: { password: string },
  ): Promise<
    | { ok: true; already: boolean; state: ExportState }
    | { ok: false; reason: 'wrong_password' | 'network' }
  >;
  deleteAccount(
    accountId: string,
    input: { password: string; confirm: string },
  ): Promise<
    { ok: true; days: number } | { ok: false; reason: 'wrong_password' | 'confirm' | 'network' }
  >;
  /** Set while the account waits out the grace period (M02-S08). Only the cancel screen reads it. */
  deletionState(accountId: string): Promise<DeletionState>;
  cancelDeletion(accountId: string): Promise<{ ok: true } | { ok: false; reason: 'network' }>;
}

export type DeletionState = { pending: false } | { pending: true; purgeDate: string; days: number };

export interface SiteContent {
  platformName: string;
  tagline: string;
  supportEmail: string;
  valueLines: string[];
  signUpOpen: boolean;
  logoUrl?: string;
  footerLinks: Array<{ label: string; href: string }>;
  maintenance: { active: boolean; expectedBack?: string; banner?: string };
}

export interface LegalPage {
  slug: 'terms' | 'privacy' | 'about' | 'help';
  title: string;
  updated: string;
  readingMinutes: number;
  draft: boolean;
  /** Intro line under the About headline. */
  lead?: string;
  sections: Array<{ id: string; heading: string; body: string[] }>;
  /** Sanitised HTML from the admin pages editor. When present it replaces the section bodies. */
  html?: string;
}

export interface SiteRepository {
  content(): Promise<SiteContent>;
  legal(slug: string): Promise<LegalPage | null>;
  helpArticles(): Promise<Array<{ id: string; question: string; answer: string }>>;
}
