import 'server-only';
import { delegating } from './mode';
import type { SearchAdminService, SynonymSaveResult } from './search-admin-types';
import { checkSynonymText } from '../../admin/synonym-text';
import { groupsToText } from '../../admin/synonym-format';

/**
 * The Discovery tab data (M45-S08, M45-S09): the synonym groups as editable text and the searches that found
 * nothing. The real service reads and writes Postgres through the catalog. The fixture keeps both in memory for
 * `ADMIN_DATA=fixture` runs and unit tests.
 */
let groups: string[][] = [
  ['money', 'finance', 'cash', 'budget'],
  ['farm', 'farming', 'agriculture'],
];

const fixture: SearchAdminService = {
  async load() {
    return {
      synonyms: groupsToText(groups),
      misses: [
        { query: 'budgetng', hits: 14, lastSeen: new Date().toISOString() },
        { query: 'bitcoin', hits: 4, lastSeen: new Date(Date.now() - 4 * 86_400_000).toISOString() },
      ],
    };
  },
  async saveSynonyms(_actor, text): Promise<SynonymSaveResult> {
    const checked = checkSynonymText(text);
    if (checked.errors.length > 0) return { ok: false, errors: checked.errors };
    groups = checked.groups;
    return { ok: true, synonyms: groupsToText(groups) };
  },
};

export const searchAdmin: SearchAdminService = delegating(
  fixture,
  async () => (await import('./real/search-admin')).realSearchAdmin,
);
