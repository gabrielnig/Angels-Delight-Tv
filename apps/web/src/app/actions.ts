'use server';

import { withoutKidsLocked } from '../lib/playback-lock';
import { cookies } from 'next/headers';
import {
  getAccount,
  getAuth,
  getCatalog,
  getLibrary,
  getProfiles,
  type AuthResult,
  type CodeResult,
  type PlaybackSettings,
  type ProfileInput,
  type SignUpResult,
  type Suggestion,
} from '../lib/data';
import { currentAccountId, getSession, sessionCookieNames } from '../lib/session';
import { realDataEnabled } from '../server/data/mode';
import { cookieProfileIo } from '../server/data/profile-io';

/**
 * Server actions for the viewer UI. Each one resolves the signed in profile itself and only calls the
 * data interfaces in lib/data, so swapping fixtures for real services needs no change here.
 */

async function context() {
  const session = await getSession();
  if (!session?.profile) throw new Error('No profile selected');
  return {
    session,
    ctx: {
      accountId: session.accountId,
      profileId: session.profile.id,
      audience: session.profile.kids ? ('kids' as const) : ('adult' as const),
    },
  };
}

const cookieOptions = { path: '/', httpOnly: true, sameSite: 'lax' as const };

// ---- Auth ----

export async function signInAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<AuthResult> {
  const result = await getAuth().signIn(input);
  if (result.ok) (await cookies()).delete(sessionCookieNames.fixture);
  return result;
}

export async function signUpAction(input: {
  email: string;
  password: string;
  inviteCode?: string;
}): Promise<SignUpResult> {
  return getAuth().signUp(input);
}

export async function verifyEmailAction(input: { code: string }): Promise<CodeResult> {
  const result = await getAuth().verifyEmail(input);
  if (result.ok) (await cookies()).delete(sessionCookieNames.fixture);
  return result;
}

export async function resendCodeAction() {
  return getAuth().resendCode();
}

export async function requestResetAction(input: { email: string }) {
  return getAuth().requestPasswordReset(input);
}

export async function resetPasswordAction(input: { token: string; password: string }) {
  return getAuth().resetPassword(input);
}

export async function signOutAction() {
  await getAuth().signOut();
  const jar = await cookies();
  jar.set(sessionCookieNames.fixture, 'out', cookieOptions);
  jar.delete(sessionCookieNames.profile);
  if (realDataEnabled()) await cookieProfileIo().clearActive();
}

// ---- Profiles ----

/** Makes a profile the active one. Real data sets the signed cookie itself, fixtures use the plain one. */
async function activate(accountId: string, profileId: string, proof?: SelectProof) {
  const result = await getProfiles().select(accountId, profileId, proof);
  if (result.ok && !realDataEnabled())
    (await cookies()).set(sessionCookieNames.profile, profileId, cookieOptions);
  return result;
}

type SelectProof = { pin?: string; password?: string };

/** A PIN profile answers `pin_required` until the PIN or the account password is given. The server counts tries. */
export async function selectProfileAction(profileId: string, proof?: SelectProof) {
  return activate(await currentAccountId(), profileId, proof);
}

export async function createProfileAction(input: ProfileInput) {
  return getProfiles().create(await currentAccountId(), input);
}

export async function updateProfileAction(
  id: string,
  input: Partial<ProfileInput> & { password?: string },
) {
  if (input.password) {
    const check = await getAuth().checkPassword(input.password);
    if (!check.ok) return { ok: false as const, reason: 'password_required' as const };
  }
  return getProfiles().update(await currentAccountId(), id, input);
}

export async function deleteProfileAction(id: string) {
  const result = await getProfiles().remove(await currentAccountId(), id);
  if (result.ok) {
    const jar = await cookies();
    if (jar.get(sessionCookieNames.profile)?.value === id) jar.delete(sessionCookieNames.profile);
  }
  return result;
}

export async function checkKidsPasswordAction(password: string) {
  const result = await getAuth().checkPassword(password);
  if (result.ok) {
    if (realDataEnabled()) await cookieProfileIo().clearLock();
    const accountId = await currentAccountId();
    // Prefer a grown-up profile without a PIN. When every one has a PIN, leave the kids profile and show the
    // picker, which asks for it (M03-S12). The server refuses a PIN profile without proof either way.
    const adult = (await getProfiles().list(accountId)).find((p) => !p.kids && !p.hasPin);
    if (adult) {
      await activate(accountId, adult.id);
    } else if (realDataEnabled()) {
      await cookieProfileIo().clearActive();
    }
  }
  return result;
}

// ---- Library ----

export async function toggleListAction(itemKey: string, add: boolean) {
  const { ctx } = await context();
  if (add) await getLibrary().addToList(ctx, itemKey);
  else await getLibrary().removeFromList(ctx, itemKey);
}

export async function addToListAction(itemKey: string) {
  return toggleListAction(itemKey, true);
}

export async function removeFromListAction(itemKey: string) {
  return toggleListAction(itemKey, false);
}

export async function loadMoreHomeRowsAction(cursor: string) {
  const { ctx } = await context();
  return getCatalog().homeRows(ctx, cursor);
}

/** Per row retry for the Home rows that load on the server (M05-S02). */
export async function reloadMyListRowAction() {
  const { ctx } = await context();
  return (await getLibrary().myList(ctx)).items.slice(0, 20);
}

export async function reloadContinueRowAction() {
  const { ctx } = await context();
  return getLibrary().continueWatching(ctx);
}

export async function loadMoreMyListAction(cursor: string) {
  const { ctx } = await context();
  return getLibrary().myList(ctx, cursor);
}

export async function removeContinueAction(videoId: string) {
  const { ctx } = await context();
  await getLibrary().removeFromContinue(ctx, videoId);
}

export async function restoreContinueAction(videoId: string) {
  const { ctx } = await context();
  await getLibrary().restoreContinue(ctx, videoId);
}

// ---- Catalog ----

export async function suggestAction(q: string): Promise<Suggestion[]> {
  const { ctx } = await context();
  return getCatalog().suggest(ctx, q);
}

export async function loadMoreBrowseAction(query: {
  categorySlug?: string;
  length?: 'any' | 'short' | 'medium' | 'long';
  sort?: 'newest' | 'shortest' | 'longest';
  cursor: string;
}) {
  const { ctx } = await context();
  return getCatalog().browse(ctx, query);
}

export async function loadMoreSearchAction(q: string, cursor: string) {
  const { ctx } = await context();
  return getCatalog().search(ctx, q, cursor);
}

// ---- Account ----

/** The player saves one profile's speed, captions, data saver and autoplay choices here (M03-S09). */
export async function savePlayerPrefsAction(profileId: string, patch: Partial<PlaybackSettings>) {
  await getAccount().savePlayback(profileId, patch);
}

/** One time move of choices an older version kept in this browser. The server applies it once per profile. */
export async function migrateDevicePrefsAction(profileId: string, legacy: Record<string, unknown>) {
  return getAccount().migrateDevicePlayback(profileId, legacy);
}

export async function savePlaybackAction(patch: Partial<PlaybackSettings>) {
  const { ctx } = await context();
  return getAccount().savePlayback(
    ctx.profileId,
    withoutKidsLocked(patch, ctx.audience === 'kids'),
  );
}

export async function changePasswordAction(input: { current: string; next: string }) {
  return getAccount().changePassword(await currentAccountId(), input);
}

export async function updateNameAction(input: { name: string }) {
  return getAccount().updateName(await currentAccountId(), input.name);
}

export async function requestEmailChangeAction(input: { newEmail: string; password: string }) {
  return getAccount().requestEmailChange(await currentAccountId(), input);
}

export async function confirmEmailChangeAction(input: { code: string }) {
  return getAccount().confirmEmailChange(await currentAccountId(), input);
}

export async function revokeDeviceAction(id: string) {
  await getAccount().revokeDevice(await currentAccountId(), id);
}

export async function revokeOtherDevicesAction() {
  return getAccount().revokeOtherDevices(await currentAccountId());
}

export async function requestExportAction(input: { password: string }) {
  return getAccount().requestExport(await currentAccountId(), input);
}

export async function cancelDeletionAction() {
  return getAccount().cancelDeletion(await currentAccountId());
}

export async function deleteAccountAction(input: { password: string; confirm: string }) {
  return getAccount().deleteAccount(await currentAccountId(), input);
}
