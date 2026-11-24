'use client';

import { useState } from 'react';
import { SETTING_DEFS, type SettingKey } from '@ad/theme/client';
import type { SiteSettingsDto } from '@/lib/data/admin/site-types';
import type { ActionResult } from '@/lib/data/admin/theme-types';
import { Switch, TextArea, TextField } from '../fields';
import { Button } from '../Button';
import { Card } from '../PageHeader';
import { useToast } from '../Toast';
import { FormActions } from './FormActions';
import { useSettingsForm } from './useSettingsForm';

const DESCRIPTION_LIMIT = 160;
const KEYS: SettingKey[] = [
  'seo.site_description',
  'seo.default_social_image_url',
  'seo.share_text_template',
  'seo.indexing',
  'seo.share_channels',
  'consent.notice_enabled',
  'consent.notice_text',
  'consent.notice_version',
];

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  x: 'X',
  email: 'Email',
};

const label = (key: SettingKey) => SETTING_DEFS[key].label;
const hint = (key: SettingKey) => SETTING_DEFS[key].description;

interface Props {
  data: SiteSettingsDto;
  actions: { update(changes: Record<string, unknown>): Promise<ActionResult<SiteSettingsDto>> };
  onSaved: (data: SiteSettingsDto) => void;
}

/** M45-S05 and M45-S06: what search engines and link previews show, who can share where, and the storage notice. */
export function DiscoveryTab({ data, actions, onSaved }: Props) {
  const toast = useToast();
  const form = useSettingsForm({ keys: KEYS, data, update: actions.update, onSaved });
  const [showPreview, setShowPreview] = useState(true);
  const str = (key: SettingKey) => String(form.draft[key] ?? '');
  const description = str('seo.site_description');
  const tagline = String(data.values['platform.tagline'] ?? '');
  const siteName = String(data.values['platform.name'] ?? '');
  const shown = description.trim() || tagline;
  const over = description.length > DESCRIPTION_LIMIT;
  const channels = (form.draft['seo.share_channels'] as string[]) ?? [];
  const version = Number(form.draft['consent.notice_version'] ?? 1);
  const savedVersion = Number(data.values['consent.notice_version'] ?? 1);
  const image = str('seo.default_social_image_url');

  function toggleChannel(channel: string, on: boolean) {
    const order = Object.keys(CHANNEL_LABELS);
    const next = order.filter((c) => (c === channel ? on : channels.includes(c)));
    form.set('seo.share_channels', next);
  }

  async function save() {
    if (over) return;
    if (await form.save()) {
      toast.show({
        message: 'Discovery settings saved. They apply within 5 minutes.',
        tone: 'success',
      });
    }
  }

  return (
    <Card title="Discovery">
      <div className="adm-stack">
        <TextArea
          label={label('seo.site_description')}
          hint={hint('seo.site_description')}
          rows={3}
          value={description}
          error={
            over
              ? `Use ${DESCRIPTION_LIMIT} characters or fewer`
              : form.errors['seo.site_description']
          }
          aside={
            <span className={`ads-counter${over ? ' is-over' : ''}`} aria-live="polite">
              {description.length} of {DESCRIPTION_LIMIT}
            </span>
          }
          onChange={(event) => form.set('seo.site_description', event.target.value)}
        />
        <TextField
          label={label('seo.default_social_image_url')}
          hint={hint('seo.default_social_image_url')}
          inputMode="url"
          placeholder="https://"
          value={image}
          error={form.errors['seo.default_social_image_url']}
          onChange={(event) => form.set('seo.default_social_image_url', event.target.value)}
        />
        <TextField
          label={label('seo.share_text_template')}
          hint={hint('seo.share_text_template')}
          value={str('seo.share_text_template')}
          error={form.errors['seo.share_text_template']}
          onChange={(event) => form.set('seo.share_text_template', event.target.value)}
        />

        <div className="ads-previews">
          <Button variant="ghost" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? 'Hide previews' : 'Show previews'}
          </Button>
          {showPreview ? (
            <div className="ads-previews__grid">
              <section aria-label="Search result preview" className="ads-serp">
                <p className="ads-serp__url">{siteName}</p>
                <p className="ads-serp__title">{siteName}</p>
                <p className="ads-serp__desc">{shown}</p>
                {description.trim() === '' ? (
                  <p className="adm-field__hint">
                    {tagline ? 'Using the tagline' : 'Add a description'}
                  </p>
                ) : null}
              </section>
              <section aria-label="Share card preview" className="ads-card">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ads-card__img" src={image} alt="" width={1200} height={630} />
                ) : (
                  <div className="ads-card__img ads-card__img--empty" aria-hidden="true" />
                )}
                <p className="ads-card__title">{siteName}</p>
                <p className="ads-card__desc">{shown}</p>
              </section>
            </div>
          ) : null}
        </div>

        <div className="ads-flags">
          <div className="ads-flag">
            <div>
              <span className="adm-field__label">{label('seo.indexing')}</span>
              <p className="adm-field__hint">{hint('seo.indexing')}</p>
              <p className="adm-field__hint">
                Kids only titles are never listed by search engines.
              </p>
            </div>
            <Switch
              label={label('seo.indexing')}
              checked={form.draft['seo.indexing'] === true}
              onChange={(value) => form.set('seo.indexing', value)}
            />
          </div>
        </div>

        <fieldset className="ads-links">
          <legend className="adm-field__label">{label('seo.share_channels')}</legend>
          <p className="adm-field__hint">{hint('seo.share_channels')}</p>
          <div className="ads-flags">
            {Object.entries(CHANNEL_LABELS).map(([channel, name]) => (
              <div className="ads-flag" key={channel}>
                <span className="adm-field__label">{name}</span>
                <Switch
                  label={name}
                  checked={channels.includes(channel)}
                  onChange={(value) => toggleChannel(channel, value)}
                />
              </div>
            ))}
          </div>
          <p className="adm-field__hint">Copy link is always on</p>
        </fieldset>

        <div className="ads-flags">
          <div className="ads-flag">
            <div>
              <span className="adm-field__label">{label('consent.notice_enabled')}</span>
              <p className="adm-field__hint">{hint('consent.notice_enabled')}</p>
            </div>
            <Switch
              label={label('consent.notice_enabled')}
              checked={form.draft['consent.notice_enabled'] === true}
              onChange={(value) => form.set('consent.notice_enabled', value)}
            />
          </div>
        </div>
        <TextArea
          label={label('consent.notice_text')}
          hint={hint('consent.notice_text')}
          rows={3}
          value={str('consent.notice_text')}
          error={form.errors['consent.notice_text']}
          onChange={(event) => form.set('consent.notice_text', event.target.value)}
        />
        <div className="ads-flag">
          <p className="adm-field__hint">
            Notice version {version}
            {version !== savedVersion ? ' (not saved yet)' : ''}
          </p>
          <Button
            variant="secondary"
            onClick={() => form.set('consent.notice_version', Math.min(9999, savedVersion + 1))}
          >
            Show notice again to everyone
          </Button>
        </div>

        <FormActions
          dirty={form.dirty}
          busy={form.busy}
          blocked={over ? `Shorten the description to ${DESCRIPTION_LIMIT} characters.` : undefined}
          onSave={() => void save()}
          onDiscard={form.discard}
          failure={form.failure}
        />
      </div>
    </Card>
  );
}
