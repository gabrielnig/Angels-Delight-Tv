import { VIEW_ALL_MODES } from '@ad/shared';
import { MAX_HERO_TEXT, type HeroText, type HomeConfig, type HomeRow } from './home-rules';

const MODES: readonly string[] = VIEW_ALL_MODES;

/** The client sends plain JSON. Rebuild it field by field so nothing unexpected is stored. */
export function cleanHomeConfig(input: HomeConfig): HomeConfig {
  const heroIds = (Array.isArray(input?.heroIds) ? input.heroIds : []).map(String).slice(0, 50);
  const heroText: Record<string, HeroText> = {};
  for (const id of heroIds) {
    const raw = input?.heroText?.[id];
    if (!raw) continue;
    const text: HeroText = {};
    for (const key of ['headline', 'blurb', 'buttonLabel'] as const) {
      const value = typeof raw[key] === 'string' ? raw[key]!.trim().slice(0, MAX_HERO_TEXT) : '';
      if (value) text[key] = value;
    }
    if (Object.keys(text).length) heroText[id] = text;
  }
  return {
    heroIds,
    ...(Object.keys(heroText).length ? { heroText } : {}),
    rows: (Array.isArray(input?.rows) ? input.rows : []).slice(0, 50).map((r): HomeRow => {
      const row: HomeRow = {
        id: String(r.id),
        type: r.type,
        name: String(r.name ?? ''),
        visible: Boolean(r.visible),
        videoIds: (Array.isArray(r.videoIds) ? r.videoIds : []).map(String).slice(0, 50),
        sourceId: r.sourceId ? String(r.sourceId) : null,
      };
      if (r.slug !== undefined) row.slug = r.slug ? String(r.slug).slice(0, 80) : null;
      if (r.viewAllMode !== undefined)
        row.viewAllMode = MODES.includes(r.viewAllMode) ? r.viewAllMode : 'auto';
      if (r.viewAllUrl !== undefined) row.viewAllUrl = r.viewAllUrl ? String(r.viewAllUrl).slice(0, 300) : null;
      if (r.minItems !== undefined) row.minItems = Number(r.minItems);
      if (r.kidsVisible !== undefined) row.kidsVisible = Boolean(r.kidsVisible);
      if (r.fallbackToNewest !== undefined) row.fallbackToNewest = Boolean(r.fallbackToNewest);
      // One over the limit is kept so validation can still refuse it.
      if (r.fallbackTitle !== undefined)
        row.fallbackTitle = r.fallbackTitle ? String(r.fallbackTitle).slice(0, 81) : null;
      return row;
    }),
  };
}
