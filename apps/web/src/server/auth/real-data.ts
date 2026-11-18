import 'server-only';
import { readPending, signPending } from '@ad/auth';
import { type AccountViewerSource, RealAccountRepository } from './account-repo';
import { type GatewayIo, RealAuthGateway } from './gateway';
import { authRuntime } from './runtime';
import { turnstileFromEnv, verifyTurnstile } from './turnstile';
import {
  clearSessionCookie,
  getSession,
  readPendingCookie,
  readSessionToken,
  requestMeta,
  setPendingCookie,
  setSessionCookie,
} from './session';

const PENDING_SECONDS = 30 * 60;

/** The request bound pieces the gateway and account repository need, wired to cookies and headers. */
export function requestIo(): GatewayIo {
  return {
    meta: requestMeta,
    setSession: setSessionCookie,
    clearSession: clearSessionCookie,
    readSessionToken,
    async currentActor() {
      const session = await getSession();
      if (!session || session.status !== 'active') return null;
      return { accountId: session.accountId, role: session.role, sessionId: session.sessionId };
    },
    async pendingDeletionActor() {
      const session = await getSession();
      if (!session || session.status !== 'pending_deletion') return null;
      return { accountId: session.accountId, role: session.role, sessionId: session.sessionId };
    },
    async setPending(email) {
      const value = signPending(authRuntime().pepper, {
        email,
        expiresAt: Date.now() + PENDING_SECONDS * 1000,
      });
      await setPendingCookie(value, PENDING_SECONDS);
    },
    async readPending() {
      return readPending(authRuntime().pepper, await readPendingCookie())?.email ?? null;
    },
  };
}

export const createRealAuth = () => {
  const keys = turnstileFromEnv(authRuntime().env);
  return new RealAuthGateway(
    authRuntime().staff,
    requestIo(),
    keys ? (token, ip) => verifyTurnstile(keys, token, ip) : undefined,
  );
};

/** `viewer` is the stats, playback settings and export source. Pass it when viewer data is real. */
export const createRealAccount = (viewer?: AccountViewerSource) => {
  const runtime = authRuntime();
  return new RealAccountRepository(
    runtime.staff,
    runtime.sessions,
    requestIo(),
    () => new Date(),
    viewer,
  );
};
