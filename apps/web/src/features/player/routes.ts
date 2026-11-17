/**
 * Routes the Watch page links to. They belong to other lanes, so they live in one place
 * and are confirmed during the integration pass.
 */
export const HOME_PATH = '/';
export const BROWSE_PATH = '/browse';
export const SEARCH_PATH = '/search';
export const HELP_PATH = '/help';
export const PLAYBACK_SETTINGS_PATH = '/account/playback';
export const signInPath = (next: string) => `/signin?next=${encodeURIComponent(next)}`;
/** Idempotent progress write, see docs/lanes/G-player.md. */
export const PROGRESS_ENDPOINT = '/api/watch/progress';
export const watchPath = (videoId: string) => `/watch/${videoId}`;
