/**
 * Routes the Watch page links to. They belong to other lanes, so they live in one place
 * and are confirmed during the integration pass.
 */
export const HOME_PATH = '/';
export const BROWSE_PATH = '/browse';
export const SEARCH_PATH = '/search';
export const HELP_PATH = '/help';
export const PLAYBACK_SETTINGS_PATH = '/settings/playback';
export const signInPath = (next: string) => `/sign-in?next=${encodeURIComponent(next)}`;
/** Progress write: the lane C route `POST /api/progress`, idempotent and reachable by sendBeacon. */
export const PROGRESS_ENDPOINT = '/api/progress';
export const watchPath = (videoId: string) => `/watch/${videoId}`;
