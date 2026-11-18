/**
 * Viewer data contracts. Pages and components depend on these interfaces only.
 * Fixture implementations live in ./fixtures. The integration pass swaps them for the real services
 * (lane B auth, lane C viewer API) without touching pages.
 */

export type Audience = 'adult' | 'kids';

export interface Thumb {
  src: string;
  srcSet?: string;
  /** jpeg copy for browsers that cannot read webp. */
  fallbackSrc?: string;
  fallbackSrcSet?: string;
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
  series?: { slug: string; title: string; season: number; episode: number };
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
  kidsSafe: boolean;
  ageLabel?: string;
  hasCaptions: boolean;
  publishedAt: string;
}

export type CatalogItem = VideoSummary | SeriesSummary;

export interface Progress {
  videoId: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: string;
}

export interface HeroSlot {
  item: CatalogItem;
  /** Optional curated line, otherwise the item description is used. */
  blurb?: string;
}

export interface HomeRow {
  id: string;
  title: string;
  seeAllHref?: string;
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

export type BrowseSort = 'newest' | 'shortest' | 'longest';
export type BrowseLength = 'any' | 'short' | 'medium' | 'long';

export interface BrowseQuery {
  categorySlug?: string;
  length?: BrowseLength;
  sort?: BrowseSort;
  cursor?: string;
  limit?: number;
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
  seasons: Array<{ number: number; episodes: Episode[] }>;
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
}

export interface CatalogRepository {
  home(ctx: ViewerContext): Promise<HomeData>;
  /** The next page of rows below the first screen. */
  homeRows(ctx: ViewerContext, cursor: string): Promise<HomeRowsPage>;
  categories(ctx: ViewerContext): Promise<Category[]>;
  browse(ctx: ViewerContext, query: BrowseQuery): Promise<Page<CatalogItem>>;
  search(ctx: ViewerContext, q: string, cursor?: string): Promise<Page<CatalogItem>>;
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
  series(ctx: ViewerContext, slug: string): Promise<SeriesDetail | { redirect: string } | null>;
}

export type PublicPreview =
  | { type: 'video'; item: VideoSummary }
  | { type: 'series'; item: SeriesSummary }
  | { type: 'redirect'; to: string };

export interface LibraryRepository {
  myList(ctx: ViewerContext, cursor?: string): Promise<Page<CatalogItem> & { hiddenCount: number }>;
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
  dataSaver: boolean;
  quality: 'auto' | '1080' | '720' | '480' | '360';
  speed: number;
  captionsDefault: boolean;
  captionSize: 'small' | 'medium' | 'large' | 'xlarge';
  captionBackground: 'none' | 'dark' | 'solid';
  captionContrast: 'standard' | 'high';
  /** Default caption language, a code such as en or yo. */
  captionLanguage: string;
}

export interface DeviceSession {
  id: string;
  label: string;
  place: string;
  lastActive: string;
  current: boolean;
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
}

export interface AccountRepository {
  overview(accountId: string): Promise<AccountOverview>;
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
  sections: Array<{ id: string; heading: string; body: string[] }>;
  /** Sanitised HTML from the admin pages editor. When present it replaces the section bodies. */
  html?: string;
}

export interface SiteRepository {
  content(): Promise<SiteContent>;
  legal(slug: string): Promise<LegalPage | null>;
  helpArticles(): Promise<Array<{ id: string; question: string; answer: string }>>;
}
