import {
  createProfile,
  deleteProfile,
  LAST_ADULT_MESSAGE,
  LAST_PROFILE_MESSAGE,
  listProfiles,
  PROFILE_LIMIT_MESSAGE,
  selectProfile,
  updateProfile,
  type UpdateProfileInput,
  type ViewerContext as ServiceContext,
} from '@ad/viewer';
import { Conflict, Forbidden, RateLimited, ValidationFailed } from '@ad/shared';
import type {
  Profile,
  ProfileFailure,
  ProfileInput,
  ProfilesRepository,
  SelectProfileResult,
} from '../../lib/data/types';
import { viewerActor } from './actor';
import { avatarFromTone, profileToView } from './mappers';

/** The request bound part: the signed active profile cookie. Wired to next/headers in runtime code. */
export interface ProfileIo {
  activeProfileId(): Promise<string | null>;
  /** True while the session is locked to a kids profile (server side, not the cookie). */
  kidsLocked(): Promise<boolean>;
  /** Records the profile on the session row and in the cookie. */
  setActive(accountId: string, profileId: string, isKids: boolean): Promise<void>;
  /** Exit kids mode: the caller has already checked the account password. */
  clearLock(): Promise<void>;
  clearActive(): Promise<void>;
}

type Result = { ok: true; profile: Profile } | { ok: false; reason: ProfileFailure };

function failure(error: unknown): { ok: false; reason: ProfileFailure } {
  if (error instanceof Conflict) {
    if (error.message === PROFILE_LIMIT_MESSAGE) return { ok: false, reason: 'limit' };
    if (error.message === LAST_ADULT_MESSAGE || error.message === LAST_PROFILE_MESSAGE) {
      return { ok: false, reason: 'last_adult' };
    }
    return { ok: false, reason: 'duplicate' };
  }
  if (error instanceof Forbidden && error.message === 'password_required') {
    return { ok: false, reason: 'password_required' };
  }
  if (error instanceof ValidationFailed) return { ok: false, reason: 'network' };
  return { ok: false, reason: 'network' };
}

/** Profiles on the real viewer service. Names are sealed with the account key inside the service. */
export class RealProfiles implements ProfilesRepository {
  readonly maxProfiles: number;

  constructor(
    private readonly service: ServiceContext,
    private readonly io: ProfileIo,
    options: { maxProfiles?: number } = {},
  ) {
    this.maxProfiles = options.maxProfiles ?? 5;
  }

  async list(accountId: string): Promise<Profile[]> {
    const [rows, active] = await Promise.all([
      listProfiles(this.service, viewerActor(accountId)),
      this.io.activeProfileId(),
    ]);
    return rows.map((row) => profileToView(row, active));
  }

  async get(accountId: string, id: string): Promise<Profile | null> {
    return (await this.list(accountId)).find((p) => p.id === id) ?? null;
  }

  async create(accountId: string, input: ProfileInput): Promise<Result> {
    try {
      const dto = await createProfile(
        this.service,
        viewerActor(accountId),
        {
          name: input.name,
          avatarId: avatarFromTone(input.tone),
          isKids: input.kids,
          language: input.language,
          autoplayNext: input.autoplayNext,
        },
        { activeProfileId: await this.io.activeProfileId() },
      );
      return { ok: true, profile: profileToView(dto, await this.io.activeProfileId()) };
    } catch (error) {
      return failure(error);
    }
  }

  async update(
    accountId: string,
    id: string,
    input: Partial<ProfileInput> & { password?: string },
  ): Promise<Result> {
    const patch: UpdateProfileInput = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.tone !== undefined) patch.avatarId = avatarFromTone(input.tone);
    if (input.kids !== undefined) patch.isKids = input.kids;
    if (input.language !== undefined) patch.language = input.language;
    if (input.autoplayNext !== undefined) patch.autoplayNext = input.autoplayNext;
    if (input.pin !== undefined) patch.pin = input.pin;
    try {
      const active = await this.io.activeProfileId();
      const dto = await updateProfile(this.service, viewerActor(accountId), id, patch, {
        activeProfileId: active,
        password: input.password,
      });
      return { ok: true, profile: profileToView(dto, active) };
    } catch (error) {
      return failure(error);
    }
  }

  async remove(
    accountId: string,
    id: string,
  ): Promise<{ ok: true } | { ok: false; reason: ProfileFailure }> {
    try {
      const active = await this.io.activeProfileId();
      await deleteProfile(this.service, viewerActor(accountId), id, { activeProfileId: active });
      if (active === id) await this.io.clearActive();
      return { ok: true };
    } catch (error) {
      return failure(error);
    }
  }

  /**
   * Opens a profile. A PIN profile needs the PIN or the account password and the server counts the tries, so a
   * forged request gains nothing. Anything else that is refused (a foreign profile, the kids lock) still throws.
   */
  async select(
    accountId: string,
    id: string,
    proof: { pin?: string; password?: string } = {},
  ): Promise<SelectProfileResult> {
    try {
      const profile = await selectProfile(this.service, viewerActor(accountId), id, {
        kidsLocked: await this.io.kidsLocked(),
        ...proof,
      });
      await this.io.setActive(accountId, id, profile.isKids);
      return { ok: true };
    } catch (error) {
      if (error instanceof RateLimited)
        return {
          ok: false,
          reason: 'locked',
          minutes: Math.max(1, Math.ceil(error.retryAfterSeconds / 60)),
        };
      if (error instanceof Forbidden) {
        if (error.message === 'pin_required') return { ok: false, reason: 'pin_required' };
        if (error.message === 'pin_invalid') return { ok: false, reason: 'pin_invalid' };
        if (error.message === 'password_incorrect')
          return { ok: false, reason: 'password_incorrect' };
      }
      throw error;
    }
  }
}
