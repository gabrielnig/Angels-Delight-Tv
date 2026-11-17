import 'server-only';
import { createFixturePlaybackData } from './playback.fixture';
import type { PlaybackData, PlaybackTransport, ViewerContext } from './playback';

/**
 * Server side wiring for the Watch page. Swap the fixture for the real service here during the
 * integration pass. Nothing else in the page changes.
 */
let instance: PlaybackData | null = null;

export function getPlaybackData(): PlaybackData {
  instance ??= createFixturePlaybackData();
  return instance;
}

/** PLAYBACK_TRANSPORT=http makes the browser use the real session and progress routes. */
export function getTransport(): PlaybackTransport {
  return process.env.PLAYBACK_TRANSPORT === 'http' ? 'http' : 'fixture';
}

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/**
 * Fixture viewer until the auth and profile lanes merge. The cookie `ad_fixture_kids=1` simulates a
 * kids profile so the kids rules can be tried by hand.
 */
export async function getViewerContext(cookies: CookieReader): Promise<ViewerContext> {
  const kids = cookies.get('ad_fixture_kids')?.value === '1';
  return { profileId: kids ? 'prof_fixture_kids' : 'prof_fixture', kids };
}
