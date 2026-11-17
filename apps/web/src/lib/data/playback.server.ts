import 'server-only';
import { DrizzlePlaybackStore } from '@ad/video';
import { redirect } from 'next/navigation';
import { realDataEnabled } from '../../server/data/mode';
import { accountViewerData } from '../../server/data/real-data';
import { cookieProfileIo } from '../../server/data/profile-io';
import { RealPlaybackData } from '../../server/data/real-playback';
import { getSession } from '../../server/auth/session';
import { viewerRuntime } from '../../server/viewer/runtime';
import { createFixturePlaybackData } from './playback.fixture';
import type { PlaybackData, PlaybackTransport, ViewerContext } from './playback';
import { loadOwnedProfile } from '@ad/viewer';
import { withAccount } from '@ad/db';
import { viewerActor } from '../../server/data/actor';

/**
 * Server side wiring for the Watch page. Real viewer data when `realDataEnabled()`, the fixture otherwise.
 * Nothing else in the page changes.
 */
let instance: PlaybackData | null = null;
let instanceIsReal = false;

export function getPlaybackData(): PlaybackData {
  const real = realDataEnabled();
  if (!instance || instanceIsReal !== real) {
    instance = real
      ? new RealPlaybackData(
          viewerRuntime().ctx,
          (accountId, profileId) => accountViewerData().playback(accountId, profileId),
          (videoId) => new DrizzlePlaybackStore(viewerRuntime().ctx.db).captions(videoId),
        )
      : createFixturePlaybackData();
    instanceIsReal = real;
  }
  return instance;
}

/**
 * How the browser gets its playback session. Production always uses http. Elsewhere `PLAYBACK_TRANSPORT=http|fixture` decides when set. Otherwise the real
 * lane D routes (`/api/play/...`) are used in production and whenever viewer data is real, because real titles have
 * no sample stream to fall back on. Fixture data keeps the sample streams.
 */
export function getTransport(
  env: Record<string, string | undefined> = process.env,
): PlaybackTransport {
  if (env.NODE_ENV === 'production') return 'http';
  if (env.PLAYBACK_TRANSPORT === 'http' || env.PLAYBACK_TRANSPORT === 'fixture')
    return env.PLAYBACK_TRANSPORT;
  return realDataEnabled(env) ? 'http' : 'fixture';
}

/** Progress is stored by the server whenever viewer data is real, whatever the session transport is. */
export function getProgressTransport(): PlaybackTransport {
  return realDataEnabled() ? 'http' : getTransport();
}

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/**
 * Who is watching. Real mode: the signed in account and its active profile, with `kids` read from the database.
 * A request with no valid session or profile gets an id no profile has, so the lookup answers not found.
 * Fixture mode: the cookie `ad_fixture_kids=1` simulates a kids profile so the kids rules can be tried by hand.
 */
export async function getViewerContext(
  cookies: CookieReader,
  /** The page path. When given, a missing session or profile redirects to sign in or the picker instead of answering not found. */
  next?: string,
): Promise<ViewerContext> {
  if (realDataEnabled()) {
    const session = await getSession();
    const signedIn = session !== null && session.status === 'active';
    if (next && !signedIn) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
    if (next && session && !session.emailVerified) redirect('/verify-email');
    const profileId = signedIn ? await cookieProfileIo().activeProfileId() : null;
    if (next && signedIn && !profileId) redirect('/profiles');
    if (!session || !signedIn || !profileId) return { profileId: 'none', kids: false };
    const actor = viewerActor(session.accountId);
    try {
      const profile = await withAccount(viewerRuntime().ctx.db, actor, (tx) =>
        loadOwnedProfile(tx, actor, profileId),
      );
      return { accountId: session.accountId, profileId: profile.id, kids: profile.isKids };
    } catch {
      return { profileId: 'none', kids: false };
    }
  }
  const kids = cookies.get('ad_fixture_kids')?.value === '1';
  return { profileId: kids ? 'prof_fixture_kids' : 'prof_fixture', kids };
}
