import {
  Forbidden,
  NotFound,
  ValidationFailed,
  isAdminRole,
  isSponsorSlot,
  isStaffRole,
  uuidv7,
  type AccountRole,
  type SponsorEffectiveStatus,
  type SponsorSlot,
  type SponsorStoredStatus,
  SPONSOR_STATUSES,
} from '@ad/shared';
import { deriveSponsorStatus } from '../status';
import type { CreativeWithSlots, PrivateRow, SponsorAdminStore } from './store';
import {
  cleanText,
  validateCreative,
  validateSchedule,
  validateSponsorName,
  type CreativeInput,
} from './validate';

export interface AdminActor {
  accountId: string;
  role: AccountRole;
}

export type Result = { ok: true } | { ok: false; error: string };

export interface SponsorAdminDeps {
  store: SponsorAdminStore;
  settings: { update(actor: AdminActor, changes: Record<string, unknown>): Promise<unknown> };
  reauthenticate(actor: AdminActor, password: string): Promise<Result>;
  /** Our own hostnames, so a sponsor link cannot point back at the platform. */
  ownHosts: readonly string[];
  /** Seals a contact detail for storage. Defaults to base64 for tests only. */
  seal?(plain: string): Promise<string>;
  unseal?(sealed: string): Promise<string>;
  now?: () => Date;
}

export interface SponsorForm {
  name: unknown;
  startDay: unknown;
  endDay: unknown;
  contactName: unknown;
  contactEmail: unknown;
  notes: unknown;
}

export interface SponsorSummary {
  id: string;
  name: string;
  status: SponsorStoredStatus;
  effectiveStatus: SponsorEffectiveStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  creativeCount: number;
}

export interface SponsorDetail extends SponsorSummary {
  contactName: string | null;
  contactEmailMasked: string | null;
  notes: string | null;
  creatives: CreativeWithSlots[];
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

export function maskContactEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}**${email.slice(at)}`;
}

const asFields = (errors: Record<string, string>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]]));

const assertStaff = (actor: AdminActor) => {
  if (!isStaffRole(actor.role)) throw new Forbidden('Only staff can manage sponsors');
};
const assertAdmin = (actor: AdminActor) => {
  if (!isAdminRole(actor.role)) throw new Forbidden('Only an admin can do this');
};

export class SponsorAdminService {
  private readonly store: SponsorAdminStore;
  private readonly now: () => Date;
  private readonly seal: (plain: string) => Promise<string>;
  private readonly unseal: (sealed: string) => Promise<string>;

  constructor(private readonly deps: SponsorAdminDeps) {
    this.store = deps.store;
    this.now = deps.now ?? (() => new Date());
    this.seal = deps.seal ?? (async (p) => Buffer.from(p, 'utf8').toString('base64'));
    this.unseal = deps.unseal ?? (async (s) => Buffer.from(s, 'base64').toString('utf8'));
  }

  private async readForm(form: SponsorForm) {
    const errors: Record<string, string> = {};
    const name = validateSponsorName(form.name);
    if (!name.ok) errors.name = name.error;
    const schedule = validateSchedule({ startDay: form.startDay, endDay: form.endDay });
    if (!schedule.ok) Object.assign(errors, schedule.errors);
    const email = cleanText(form.contactEmail);
    if (email && !EMAIL.test(email)) errors.contactEmail = 'Enter a valid email address.';
    const contactName = cleanText(form.contactName);
    if (contactName.length > 80) errors.contactName = 'Keep the contact name to 80 characters.';
    const notes = typeof form.notes === 'string' ? form.notes.trim() : '';
    if (notes.length > 1000) errors.notes = 'Keep the notes to 1,000 characters.';
    if (Object.keys(errors).length > 0 || !name.ok || !schedule.ok) {
      throw new ValidationFailed(asFields(errors), 'Some details need fixing');
    }
    const priv: PrivateRow = {
      contactNameSealed: contactName ? await this.seal(contactName) : null,
      contactEmailSealed: email ? await this.seal(email) : null,
      notes: notes || null,
    };
    return { name: name.value, startsAt: schedule.value.startsAt, endsAt: schedule.value.endsAt, priv };
  }

  async create(actor: AdminActor, form: SponsorForm): Promise<{ id: string }> {
    assertStaff(actor);
    const v = await this.readForm(form);
    const id = uuidv7();
    await this.store.insertSponsor(
      { id, name: v.name, status: 'draft', startsAt: v.startsAt, endsAt: v.endsAt, createdBy: actor.accountId },
      v.priv,
    );
    await this.audit(actor, 'sponsor.create', id, { name: v.name });
    return { id };
  }

  async update(actor: AdminActor, id: string, form: SponsorForm): Promise<void> {
    assertStaff(actor);
    const v = await this.readForm(form);
    const found = await this.store.updateSponsor(id, { name: v.name, startsAt: v.startsAt, endsAt: v.endsAt }, v.priv);
    if (!found) throw new NotFound('That sponsor was not found');
    await this.audit(actor, 'sponsor.update', id, { name: v.name });
  }

  async list(actor: AdminActor): Promise<SponsorSummary[]> {
    assertStaff(actor);
    const at = this.now();
    return (await this.store.listSponsors()).map(({ sponsor, creativeCount }) => ({
      id: sponsor.id,
      name: sponsor.name,
      status: sponsor.status,
      effectiveStatus: deriveSponsorStatus(sponsor, at),
      startsAt: sponsor.startsAt,
      endsAt: sponsor.endsAt,
      creativeCount,
    }));
  }

  async get(actor: AdminActor, id: string): Promise<SponsorDetail> {
    assertStaff(actor);
    const found = await this.store.getSponsor(id);
    if (!found) throw new NotFound('That sponsor was not found');
    const { sponsor, priv, creatives } = found;
    const email = priv.contactEmailSealed ? await this.unseal(priv.contactEmailSealed) : null;
    return {
      id: sponsor.id,
      name: sponsor.name,
      status: sponsor.status,
      effectiveStatus: deriveSponsorStatus(sponsor, this.now()),
      startsAt: sponsor.startsAt,
      endsAt: sponsor.endsAt,
      creativeCount: creatives.length,
      contactName: priv.contactNameSealed ? await this.unseal(priv.contactNameSealed) : null,
      contactEmailMasked: email ? maskContactEmail(email) : null,
      notes: priv.notes,
      creatives,
    };
  }

  async setStatus(actor: AdminActor, id: string, status: SponsorStoredStatus): Promise<void> {
    assertStaff(actor);
    if (!(SPONSOR_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationFailed({ status: ['Unknown status'] }, 'Unknown status');
    }
    // Only an admin approves a sponsor to run or archives one (D-263).
    if (status === 'active' || status === 'archived') assertAdmin(actor);
    const found = await this.store.getSponsor(id);
    if (!found) throw new NotFound('That sponsor was not found');
    if (status === 'active') {
      const placed = found.creatives.some((c) => c.active && c.slots.length > 0);
      if (!placed) {
        throw new ValidationFailed(
          { status: ['Add a creative and tick at least one placement before going live.'] },
          'Nothing to show yet',
        );
      }
    }
    await this.store.setStatus(id, status);
    await this.audit(actor, 'sponsor.status', id, { from: found.sponsor.status, to: status });
  }

  async remove(actor: AdminActor, id: string): Promise<Result> {
    assertAdmin(actor);
    const found = await this.store.getSponsor(id);
    if (!found) throw new NotFound('That sponsor was not found');
    if (await this.store.hasStats(id)) {
      return { ok: false, error: 'This sponsor has report numbers, so it cannot be deleted. Archive it instead.' };
    }
    await this.store.deleteSponsor(id);
    await this.audit(actor, 'sponsor.delete', id, {});
    return { ok: true };
  }

  private checkSlots(slots: unknown[]): SponsorSlot[] {
    const clean = [...new Set(slots)];
    if (!clean.every(isSponsorSlot)) {
      throw new ValidationFailed({ slots: ['Choose from the listed placements.'] }, 'Unknown placement');
    }
    return clean;
  }

  private readCreative(input: CreativeInput) {
    const checked = validateCreative(input, { ownHosts: this.deps.ownHosts });
    if (!checked.ok) throw new ValidationFailed(asFields(checked.errors), 'Some details need fixing');
    return checked.value;
  }

  async addCreative(
    actor: AdminActor,
    sponsorId: string,
    input: CreativeInput & { imageSquareAssetId?: string | null; imageWideAssetId?: string | null },
    slots: unknown[],
  ): Promise<{ id: string; warnings: string[] }> {
    assertStaff(actor);
    if (!(await this.store.getSponsor(sponsorId))) throw new NotFound('That sponsor was not found');
    const value = this.readCreative(input);
    const chosen = this.checkSlots(slots);
    const id = uuidv7();
    await this.store.insertCreative(
      {
        id,
        sponsorId,
        ...value,
        imageSquareAssetId: input.imageSquareAssetId ?? null,
        imageWideAssetId: input.imageWideAssetId ?? null,
        active: true,
      },
      chosen,
    );
    await this.audit(actor, 'sponsor.creative.add', id, { sponsorId, slots: chosen });
    return { id, warnings: chosen.length === 0 ? ['No placement is ticked, so this creative is never shown.'] : [] };
  }

  async updateCreative(
    actor: AdminActor,
    creativeId: string,
    input: CreativeInput & { imageSquareAssetId?: string | null; imageWideAssetId?: string | null; active?: boolean },
    slots: unknown[],
  ): Promise<{ warnings: string[] }> {
    assertStaff(actor);
    const existing = await this.store.getCreative(creativeId);
    if (!existing) throw new NotFound('That creative was not found');
    const value = this.readCreative(input);
    const chosen = this.checkSlots(slots);
    await this.store.updateCreative(
      creativeId,
      {
        ...value,
        imageSquareAssetId: input.imageSquareAssetId === undefined ? existing.imageSquareAssetId : input.imageSquareAssetId,
        imageWideAssetId: input.imageWideAssetId === undefined ? existing.imageWideAssetId : input.imageWideAssetId,
        active: input.active ?? existing.active,
      },
      chosen,
    );
    await this.audit(actor, 'sponsor.creative.update', creativeId, { sponsorId: existing.sponsorId, slots: chosen });
    return { warnings: chosen.length === 0 ? ['No placement is ticked, so this creative is never shown.'] : [] };
  }

  async removeCreative(actor: AdminActor, creativeId: string): Promise<void> {
    assertStaff(actor);
    const existing = await this.store.getCreative(creativeId);
    if (!existing) throw new NotFound('That creative was not found');
    await this.store.deleteCreative(creativeId);
    await this.audit(actor, 'sponsor.creative.remove', creativeId, { sponsorId: existing.sponsorId });
  }

  /** The master switch asks for the admin password again (M48-S01). The settings service writes its own audit row. */
  async setMasterSwitch(actor: AdminActor, on: boolean, password: string): Promise<Result> {
    assertAdmin(actor);
    const verdict = await this.deps.reauthenticate(actor, String(password));
    if (!verdict.ok) return verdict;
    await this.deps.settings.update(actor, { 'sponsors.enabled': on });
    await this.audit(actor, 'sponsor.master', 'sponsors.enabled', { on });
    return { ok: true };
  }

  private audit(actor: AdminActor, action: string, targetId: string, metadata: Record<string, unknown>) {
    return this.store.audit({
      action,
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'sponsor',
      targetId,
      metadata,
    });
  }
}
