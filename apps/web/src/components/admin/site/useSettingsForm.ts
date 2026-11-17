'use client';

import { useCallback, useMemo, useState } from 'react';
import { SETTING_DEFS, type SettingKey } from '@ad/theme/client';
import type { SiteSettingsDto } from '@/lib/data/admin/site-types';
import type { ActionResult } from '@/lib/data/admin/theme-types';

export interface NumberRule {
  min: number;
  max: number;
  /** Shown value is stored value divided by this, for example bytes shown as GB. */
  unit?: number;
}

/** Plain words for a value outside its range, the same wording the screen shows beside the field. */
export function rangeMessage(rule: NumberRule): string {
  return `Enter a number from ${rule.min} to ${rule.max}`;
}

type Update = (changes: Record<string, unknown>) => Promise<ActionResult<SiteSettingsDto>>;

/**
 * Draft state for one tab: the keys it owns, what changed, per key messages from the client check and from
 * the server, and Save and Discard. Values are never lost on a failed save (M29-S01 error case).
 */
export function useSettingsForm({
  keys,
  data,
  update,
  onSaved,
  rules = {},
}: {
  keys: SettingKey[];
  data: SiteSettingsDto;
  update: Update;
  onSaved: (data: SiteSettingsDto) => void;
  rules?: Partial<Record<SettingKey, NumberRule>>;
}) {
  const initial = useMemo(
    () => Object.fromEntries(keys.map((key) => [key, data.values[key]])),
    [keys, data.values],
  );
  const [draft, setDraft] = useState<Record<string, unknown>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const changed = keys.filter((key) => JSON.stringify(draft[key]) !== JSON.stringify(initial[key]));
  const dirty = changed.length > 0;

  const set = useCallback((key: SettingKey, value: unknown) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
  }, []);

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    for (const key of changed) {
      const rule = rules[key];
      const value = draft[key];
      if (
        rule &&
        (typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < rule.min * (rule.unit ?? 1) ||
          value > rule.max * (rule.unit ?? 1))
      ) {
        found[key] = rangeMessage(rule);
        continue;
      }
      const parsed = SETTING_DEFS[key].schema.safeParse(value);
      if (!parsed.success)
        found[key] = parsed.error.issues[0]?.message ?? 'This value is not valid';
    }
    return found;
  }

  async function save(): Promise<boolean> {
    const found = validate();
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return false;
    setBusy(true);
    const result = await update(Object.fromEntries(changed.map((key) => [key, draft[key]])));
    setBusy(false);
    if (result.ok) {
      onSaved(result.data);
      setDraft(Object.fromEntries(keys.map((key) => [key, result.data.values[key]])));
      return true;
    }
    setFailure(result.message);
    if (result.fields) {
      setErrors(
        Object.fromEntries(
          Object.entries(result.fields).map(([key, messages]) => [
            key,
            messages[0] ?? 'This value is not valid',
          ]),
        ),
      );
    }
    return false;
  }

  function discard() {
    setDraft(initial);
    setErrors({});
    setFailure(null);
  }

  return { draft, set, errors, dirty, busy, failure, save, discard };
}
