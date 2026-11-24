import 'server-only';
import { recordAudit } from '@ad/audit';
import { listMisses, listSynonymGroups, replaceSynonymGroups } from '@ad/catalog';
import { can } from '@/lib/admin/can';
import { groupsToText } from '@/lib/admin/synonym-format';
import { checkSynonymText } from '@/lib/admin/synonym-text';
import { adminRuntime } from '@/server/admin/runtime';
import type { SearchAdminService } from '../search-admin-types';
import { need } from './shared';

/** Synonyms and the empty search report (M45-S08, M45-S09), admins only, like the rest of site settings. */
export const realSearchAdmin: SearchAdminService = {
  async load(actor) {
    need(actor, 'settings.site');
    const db = adminRuntime().db();
    const [groups, misses] = await Promise.all([listSynonymGroups(db), listMisses(db, 50)]);
    return {
      synonyms: groupsToText(groups),
      misses: misses.map((m) => ({ query: m.query, hits: m.hits, lastSeen: m.lastSeen.toISOString() })),
    };
  },

  async saveSynonyms(actor, text) {
    if (!can(actor.role, 'settings.site')) {
      return { ok: false, errors: [], error: 'You do not have permission for this.' };
    }
    const checked = checkSynonymText(text);
    if (checked.errors.length > 0) return { ok: false, errors: checked.errors };
    const db = adminRuntime().db();
    await replaceSynonymGroups(db, checked.groups);
    await recordAudit(db, {
      action: 'search.synonyms_replace',
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'search_synonyms',
      extra: { groups: checked.groups.length },
    });
    return { ok: true, synonyms: groupsToText(checked.groups) };
  },
};
