import { VIEW_ALL_MODES } from '@ad/shared';
import type { HomeConfig, HomeRow } from './home-rules';

const MODES: readonly string[] = VIEW_ALL_MODES;

/** The client sends plain JSON. Rebuild it field by field so nothing unexpected is stored. */
export function cleanHomeConfig(input: HomeConfig): HomeConfig {
  return {
    heroIds: (Array.isArray(input?.heroIds) ? input.heroIds : []).map(String).slice(0, 50),
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
      return row;
    }),
  };
}
