'use client';

import { useState } from 'react';
import { SETTING_DEFS, type SettingKey } from '@ad/theme/client';
import type { SiteSettingsDto } from '@/lib/data/admin/site-types';
import type { ActionResult } from '@/lib/data/admin/theme-types';
import { Badge } from '../Badge';
import { SelectField, TextField } from '../fields';
import { Card } from '../PageHeader';
import { Banner } from '../states';
import { useToast } from '../Toast';
import { FormActions } from './FormActions';
import { useSettingsForm, type NumberRule } from './useSettingsForm';

const SECOND_STEP: SettingKey = 'security.staff_second_step';
const NUMBERS: Partial<Record<SettingKey, NumberRule>> = {
  'security.staff_session_idle_days': { min: 1, max: 30 },
  'security.staff_session_absolute_days': { min: 1, max: 90 },
  'security.trusted_device_days': { min: 0, max: 90 },
};
const KEYS: SettingKey[] = [SECOND_STEP, ...(Object.keys(NUMBERS) as SettingKey[])];

const label = (key: SettingKey) => SETTING_DEFS[key].label;
const hint = (key: SettingKey) => SETTING_DEFS[key].description;

interface Props {
  data: SiteSettingsDto;
  actions: { update(changes: Record<string, unknown>): Promise<ActionResult<SiteSettingsDto>> };
  onSaved: (data: SiteSettingsDto) => void;
}

/** D-397 and D-398: how staff sign in after the password, how long they stay signed in, and remembered devices. */
export function SecurityTab({ data, actions, onSaved }: Props) {
  const toast = useToast();
  const readOnly = !data.canChangeFlags;
  const form = useSettingsForm({ keys: KEYS, data, update: actions.update, onSaved, rules: NUMBERS });
  const [text, setText] = useState<Record<string, string>>({});
  const shown = (key: SettingKey) => (key in text ? text[key]! : String(form.draft[key] ?? ''));

  function change(key: SettingKey, raw: string) {
    setText((current) => ({ ...current, [key]: raw }));
    const number = raw.trim() === '' ? Number.NaN : Number(raw);
    form.set(key, Number.isFinite(number) ? number : Number.NaN);
  }

  async function save() {
    if (await form.save()) {
      setText({});
      toast.show({ message: 'Security settings saved. They apply within a minute.', tone: 'success' });
    }
  }

  return (
    <Card
      title="Security"
      aside={
        <Badge tone="neutral" icon="lock">
          Super admin only
        </Badge>
      }
    >
      {readOnly ? <Banner tone="info">You can see these settings but not change them.</Banner> : null}
      <div className="adm-stack">
        <SelectField
          label={label(SECOND_STEP)}
          hint={hint(SECOND_STEP)}
          value={String(form.draft[SECOND_STEP] ?? 'email')}
          disabled={readOnly}
          error={form.errors[SECOND_STEP]}
          onChange={(event) => form.set(SECOND_STEP, event.target.value)}
          options={[
            { value: 'email', label: 'Code sent by email' },
            { value: 'authenticator', label: 'Authenticator app' },
          ]}
        />
        <div className="ads-numbers">
          {(Object.keys(NUMBERS) as SettingKey[]).map((key) => (
            <TextField
              key={key}
              label={label(key)}
              hint={hint(key)}
              inputMode="numeric"
              value={shown(key)}
              readOnly={readOnly}
              error={form.errors[key]}
              onChange={(event) => change(key, event.target.value)}
            />
          ))}
        </div>
        {readOnly ? null : (
          <FormActions
            dirty={form.dirty}
            busy={form.busy}
            onSave={() => void save()}
            onDiscard={() => {
              form.discard();
              setText({});
            }}
            failure={form.failure}
          />
        )}
      </div>
    </Card>
  );
}
