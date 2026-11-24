import 'server-only';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { GoogleFlow, type GoogleIo } from './google-flow';
import { googleEnabled } from './google-enabled';
import { realAuthEnabled } from './mode';
import { authRuntime } from './runtime';
import {
  clearGoogleNoteCookie,
  clearGoogleStateCookie,
  getSession,
  readGoogleNoteCookie,
  readGoogleStateCookie,
  requestMeta,
  setGoogleNoteCookie,
  setGoogleStateCookie,
  setSessionCookie,
  setTwoStepCookie,
} from './session';

/** Keys set and the `features.signin_with_google` setting on. With no keys nothing here reads the database. */
export async function isGoogleEnabled(): Promise<boolean> {
  const { env } = authRuntime();
  return googleEnabled(env, async () =>
    (await themeRuntime()).settings.get('features.signin_with_google'),
  );
}

function io(): GoogleIo {
  return {
    meta: requestMeta,
    async currentActor() {
      const session = await getSession();
      if (!session || session.status !== 'active') return null;
      return { accountId: session.accountId, role: session.role, sessionId: session.sessionId };
    },
    setSession: (token, kind) => setSessionCookie(token, kind),
    setTwoStepPending: (token) => setTwoStepCookie(token, 600),
    setState: setGoogleStateCookie,
    readState: readGoogleStateCookie,
    clearState: clearGoogleStateCookie,
    setNote: setGoogleNoteCookie,
    readNote: readGoogleNoteCookie,
    clearNote: clearGoogleNoteCookie,
  };
}

/** The Google flow for this request, or null when no keys are configured (the routes then answer 404). */
export function googleFlow(): GoogleFlow | null {
  const runtime = authRuntime();
  if (!runtime.google) return null;
  return new GoogleFlow(runtime.google, io(), isGoogleEnabled);
}

/**
 * What the Sign in and Sign up pages need to draw the button, or null. Fixture mode and a missing configuration
 * both give null without touching the database, so the card closes up.
 */
export async function googleButton(): Promise<{ href: string } | null> {
  if (!realAuthEnabled()) return null;
  return (await isGoogleEnabled()) ? { href: '/api/auth/google/start' } : null;
}

/** The link or consent note for the two confirmation screens, or null when there is none. */
export async function googleNoteInfo(): Promise<{ kind: 'link' | 'signup'; hint: string } | null> {
  if (!realAuthEnabled()) return null;
  return (await googleFlow()?.noteInfo()) ?? null;
}

/** The Security card state, or null when Google is off. */
export async function googleCardState() {
  if (!realAuthEnabled()) return null;
  return (await googleFlow()?.cardState()) ?? null;
}
