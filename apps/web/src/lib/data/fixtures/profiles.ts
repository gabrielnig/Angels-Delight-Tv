import type { Profile, ProfileInput, ProfilesRepository } from '../types';

const seed = (): Profile[] => [
  { id: 'prof-1', name: 'Adaeze', kids: false, owner: true, language: 'en', autoplayNext: true, lastUsedHere: true },
  { id: 'prof-2', name: 'Emeka', kids: false, owner: false, language: 'en', autoplayNext: true },
  { id: 'prof-3', name: 'Amina', kids: true, owner: false, language: 'en', autoplayNext: false },
  { id: 'prof-4', name: 'Tobi', kids: true, owner: false, language: 'en', autoplayNext: false },
];

const globalStore = globalThis as unknown as { __adFixtureProfiles?: Map<string, Profile[]> };
const store = (globalStore.__adFixtureProfiles ??= new Map<string, Profile[]>());
let counter = 100;

const profilesOf = (accountId: string) => {
  let list = store.get(accountId);
  if (!list) {
    list = seed();
    store.set(accountId, list);
  }
  return list;
};

export function resetFixtureProfiles() {
  store.clear();
}

export class FixtureProfiles implements ProfilesRepository {
  maxProfiles = 5;

  async list(accountId: string) {
    return [...profilesOf(accountId)];
  }

  async get(accountId: string, id: string) {
    return profilesOf(accountId).find((p) => p.id === id) ?? null;
  }

  async create(accountId: string, input: ProfileInput) {
    const list = profilesOf(accountId);
    if (list.length >= this.maxProfiles) return { ok: false as const, reason: 'limit' as const };
    if (list.some((p) => p.name.toLowerCase() === input.name.trim().toLowerCase()))
      return { ok: false as const, reason: 'duplicate' as const };
    counter += 1;
    const profile: Profile = {
      id: `prof-${counter}`,
      name: input.name.trim(),
      kids: input.kids,
      tone: input.tone,
      owner: false,
      language: input.language ?? 'en',
      autoplayNext: input.autoplayNext ?? !input.kids,
    };
    list.push(profile);
    return { ok: true as const, profile };
  }

  async update(accountId: string, id: string, input: Partial<ProfileInput> & { password?: string }) {
    const list = profilesOf(accountId);
    const index = list.findIndex((p) => p.id === id);
    const current = list[index];
    if (!current) return { ok: false as const, reason: 'network' as const };
    if (input.name && list.some((p) => p.id !== id && p.name.toLowerCase() === input.name!.trim().toLowerCase()))
      return { ok: false as const, reason: 'duplicate' as const };
    if (current.kids && input.kids === false && !input.password)
      return { ok: false as const, reason: 'password_required' as const };
    if (!current.kids && input.kids === true) {
      const otherAdults = list.filter((p) => p.id !== id && !p.kids);
      if (otherAdults.length === 0) return { ok: false as const, reason: 'last_adult' as const };
    }
    const next: Profile = {
      ...current,
      name: input.name?.trim() ?? current.name,
      kids: input.kids ?? current.kids,
      tone: input.tone ?? current.tone,
      language: input.language ?? current.language,
      autoplayNext: input.autoplayNext ?? current.autoplayNext,
    };
    list[index] = next;
    return { ok: true as const, profile: next };
  }

  async remove(accountId: string, id: string) {
    const list = profilesOf(accountId);
    const target = list.find((p) => p.id === id);
    if (!target) return { ok: false as const, reason: 'network' as const };
    if (!target.kids && list.filter((p) => !p.kids).length === 1)
      return { ok: false as const, reason: 'last_adult' as const };
    store.set(
      accountId,
      list.filter((p) => p.id !== id),
    );
    return { ok: true as const };
  }

  async select(accountId: string, id: string) {
    for (const p of profilesOf(accountId)) p.lastUsedHere = p.id === id;
  }
}
