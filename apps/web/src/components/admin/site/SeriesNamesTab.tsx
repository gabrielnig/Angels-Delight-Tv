'use client';

import { useState } from 'react';
import {
  DEFAULT_SERIES_LABELS,
  validateSeriesLabels,
  type SeriesLabelSetting,
} from '@ad/shared/series-labels';
import type { SettingKey } from '@ad/theme/client';
import type { SiteSettingsDto } from '@/lib/data/admin/site-types';
import type { ActionResult } from '@/lib/data/admin/theme-types';
import { Card } from '../PageHeader';
import { useToast } from '../Toast';
import { FormActions } from './FormActions';
import { SeriesNamesFields } from './SeriesNamesFields';
import { useSettingsForm } from './useSettingsForm';

const KEY = 'content.series_labels' satisfies SettingKey;
const KEYS: SettingKey[] = [KEY];

interface Props {
  data: SiteSettingsDto;
  actions: { update(changes: Record<string, unknown>): Promise<ActionResult<SiteSettingsDto>> };
  onSaved: (data: SiteSettingsDto) => void;
}

/** M50-S01: the site wide words for the groups and items of a series. A series can override them in its editor. */
export function SeriesNamesTab({ data, actions, onSaved }: Props) {
  const toast = useToast();
  const form = useSettingsForm({ keys: KEYS, data, update: actions.update, onSaved });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const value = (form.draft[KEY] as SeriesLabelSetting | undefined) ?? DEFAULT_SERIES_LABELS;

  async function save() {
    const checked = validateSeriesLabels(value);
    if (!checked.ok) {
      setFieldErrors(checked.errors);
      return;
    }
    setFieldErrors({});
    if (await form.save()) toast.show({ message: 'Series names saved.', tone: 'success' });
  }

  return (
    <Card title="Series names">
      <div className="adm-stack">
        <p className="adm-field__hint">
          Choose the words viewers see for the groups and items of every series. Nothing changes
          until you save. One series can use its own words from its editor.
        </p>
        <SeriesNamesFields
          value={value}
          errors={fieldErrors}
          onChange={(next) => {
            setFieldErrors({});
            form.set(KEY, next);
          }}
        />
        <FormActions
          dirty={form.dirty}
          busy={form.busy}
          onSave={() => void save()}
          onDiscard={() => {
            setFieldErrors({});
            form.discard();
          }}
          failure={form.failure}
        />
      </div>
    </Card>
  );
}
