'use client';

import { useState } from 'react';
import { SETTING_DEFS, type SettingKey } from '@ad/theme/client';
import type { PageSlug } from '@ad/theme/client';
import type { InviteCodeDto, PageDto, SiteSettingsDto } from '@/lib/data/admin/site-types';
import type { ActionResult } from '@/lib/data/admin/theme-types';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { ConfirmDialog } from '../Dialog';
import { Switch, TextField } from '../fields';
import { Icon } from '../Icon';
import { Card, PageHeader } from '../PageHeader';
import { Banner } from '../states';
import { Tabs } from '../Tabs';
import { useToast } from '../Toast';
import { InviteCodesTab, type InviteCodeActions } from './InviteCodesTab';
import { PagesEditor } from './PagesEditor';
import { useSettingsForm, type NumberRule } from './useSettingsForm';
import './site.css';

export interface SiteActions extends Partial<InviteCodeActions> {
  update(changes: Record<string, unknown>): Promise<ActionResult<SiteSettingsDto>>;
  savePage(slug: PageSlug, body: string): Promise<ActionResult<PageDto>>;
  publishPage(slug: PageSlug): Promise<ActionResult<SiteSettingsDto>>;
  restorePage(slug: PageSlug, version: number): Promise<ActionResult<PageDto>>;
}

type TabId = 'platform' | 'features' | 'home' | 'invites' | 'pages' | 'maintenance';

const GIB = 1024 ** 3;

const PLATFORM_KEYS: SettingKey[] = [
  'platform.name',
  'platform.tagline',
  'platform.support_email',
  'platform.footer_text',
  'platform.canonical_host',
  'content.default_language',
  'platform.social_links',
];

const FLAG_KEYS: SettingKey[] = [
  'features.signups_open',
  'features.kids_profiles',
  'features.my_list',
  'features.autoplay_hero',
  'features.data_saver_default',
  'features.require_approved_captions',
  'features.captions_default_available',
  'features.guest_play',
  'features.airplay',
];

const NUMBER_RULES: Partial<Record<SettingKey, NumberRule>> = {
  'limits.max_profiles': { min: 1, max: 10 },
  'limits.max_sessions': { min: 1, max: 10 },
  'limits.upload_max_bytes': { min: 0.01, max: 5, unit: GIB },
  'limits.lockout_attempts': { min: 3, max: 20 },
  'limits.lockout_minutes': { min: 1, max: 1440 },
  'limits.guest_segment_minutes': { min: 5, max: 120 },
  'playback.finish_percent': { min: 80, max: 100 },
  'playback.start_threshold_seconds': { min: 0, max: 60 },
  'playback.rewind_seconds': { min: 0, max: 30 },
  'playback.countdown_seconds': { min: 5, max: 10 },
  'analytics.raw_retention_days': { min: 7, max: 730 },
  'audit.retention_months': { min: 6, max: 120 },
};
const NUMBER_KEYS = Object.keys(NUMBER_RULES) as SettingKey[];

const HOME_FLAGS: SettingKey[] = ['home.hero_previews', 'home.hero_previews_unknown_connection'];
const HOME_NUMBERS: Partial<Record<SettingKey, NumberRule>> = {
  'home.hero_interval_seconds': { min: 5, max: 20 },
  'home.hero_max_loops': { min: 0, max: 5 },
  'home.hero_fallback_count': { min: 1, max: 5 },
};
const HOME_TEXTS: SettingKey[] = ['home.view_all_label', 'home.continue_title'];
const HOME_KEYS = [...HOME_FLAGS, ...HOME_TEXTS, ...(Object.keys(HOME_NUMBERS) as SettingKey[])];
const MAINTENANCE_KEYS: SettingKey[] = ['maintenance.banner', 'maintenance.mode'];

const label = (key: SettingKey) => SETTING_DEFS[key].label;
const hint = (key: SettingKey) => SETTING_DEFS[key].description;

export function SiteSettingsView({
  initial,
  actions,
  invites,
}: {
  initial: SiteSettingsDto;
  actions: SiteActions;
  /** Present when the person may manage invite codes. The tab is hidden without it. */
  invites?: InviteCodeDto[];
}) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<TabId>('platform');
  const open = data.checklist.filter((item) => !item.done).length;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Site settings' }]}
        title="Site settings"
        lead="Platform details, features and limits, pages"
      />
      <div className="ads-layout">
        <div className="ads-main">
          <Tabs
            label="Site settings sections"
            value={tab}
            onChange={(id) => setTab(id as TabId)}
            tabs={[
              { id: 'platform', label: 'Platform details' },
              { id: 'features', label: 'Features and limits' },
              { id: 'home', label: 'Home' },
              ...(invites && actions.create && actions.revoke
                ? [{ id: 'invites', label: 'Invite codes' }]
                : []),
              { id: 'pages', label: 'Pages' },
              { id: 'maintenance', label: 'Maintenance' },
            ]}
          >
            {tab === 'platform' ? (
              <PlatformTab data={data} actions={actions} onSaved={setData} />
            ) : null}
            {tab === 'features' ? (
              <FeaturesTab data={data} actions={actions} onSaved={setData} />
            ) : null}
            {tab === 'home' ? <HomeTab data={data} actions={actions} onSaved={setData} /> : null}
            {tab === 'invites' && invites && actions.create && actions.revoke ? (
              <InviteCodesTab
                initial={invites}
                signUpOpen={data.values['features.signups_open'] === true}
                actions={{ create: actions.create, revoke: actions.revoke }}
              />
            ) : null}
            {tab === 'pages' ? (
              <PagesEditor pages={data.pages} actions={actions} onPublished={setData} />
            ) : null}
            {tab === 'maintenance' ? (
              <MaintenanceTab data={data} actions={actions} onSaved={setData} />
            ) : null}
          </Tabs>
        </div>
        <aside className="ads-checklist" aria-label="Launch checklist">
          <Card
            title="Launch checklist"
            aside={
              <Badge
                tone={open === 0 ? 'success' : 'warning'}
                icon={open === 0 ? 'check' : 'alert'}
              >
                {open === 0 ? 'All set' : `${open} ${open === 1 ? 'item' : 'items'} not set`}
              </Badge>
            }
          >
            <ul className="adm-list">
              {data.checklist.map((item) => (
                <li key={item.id}>
                  <span className="ads-check">
                    <Icon name={item.done ? 'check' : 'alert'} size={18} />
                    <span>
                      <span className="adm-list__title">{item.label}</span>
                      <span className="adm-list__sub">{item.done ? 'Done' : item.detail}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}

interface TabProps {
  data: SiteSettingsDto;
  actions: SiteActions;
  onSaved: (data: SiteSettingsDto) => void;
}

function FormActions({
  dirty,
  busy,
  onSave,
  onDiscard,
  failure,
  children,
}: {
  dirty: boolean;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
  failure: string | null;
  children?: React.ReactNode;
}) {
  return (
    <>
      {failure ? (
        <Banner tone="danger">
          <strong>Your changes are still here.</strong> {failure}
        </Banner>
      ) : null}
      <div className="adm-form-actions">
        {dirty ? (
          <Badge tone="warning" icon="alert">
            Unsaved changes
          </Badge>
        ) : null}
        {children}
        <Button variant="ghost" disabled={!dirty || busy} onClick={onDiscard}>
          Discard
        </Button>
        <Button
          variant="primary"
          loading={busy}
          disabledReason={dirty ? undefined : 'No changes to save.'}
          onClick={onSave}
        >
          Save changes
        </Button>
      </div>
    </>
  );
}

function PlatformTab({ data, actions, onSaved }: TabProps) {
  const toast = useToast();
  const form = useSettingsForm({ keys: PLATFORM_KEYS, data, update: actions.update, onSaved });
  const text = (key: SettingKey) => String(form.draft[key] ?? '');
  const links = (form.draft['platform.social_links'] as { label: string; url: string }[]) ?? [];

  async function save() {
    if (await form.save()) toast.show({ message: 'Settings saved.', tone: 'success' });
  }

  const field = (
    key: SettingKey,
    extra: { type?: string; inputMode?: 'email' | 'url' | 'text'; placeholder?: string } = {},
  ) => (
    <TextField
      key={key}
      label={label(key)}
      hint={hint(key)}
      value={text(key)}
      error={form.errors[key]}
      onChange={(event) => form.set(key, event.target.value)}
      {...extra}
    />
  );

  return (
    <Card title="Platform details">
      <div className="adm-stack">
        {field('platform.name')}
        {field('platform.tagline')}
        {field('platform.support_email', { type: 'email', inputMode: 'email' })}
        {field('platform.footer_text')}
        {field('platform.canonical_host', { placeholder: 'angelsdelight.tv' })}
        {field('content.default_language')}
        <fieldset className="ads-links">
          <legend className="adm-field__label">{label('platform.social_links')}</legend>
          <p className="adm-field__hint">{hint('platform.social_links')}</p>
          {links.map((link, index) => (
            <div className="ads-link-row" key={index}>
              <TextField
                label="Name"
                value={link.label}
                onChange={(event) =>
                  form.set(
                    'platform.social_links',
                    links.map((item, i) =>
                      i === index ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
              />
              <TextField
                label="Link"
                value={link.url}
                inputMode="url"
                placeholder="https://"
                onChange={(event) =>
                  form.set(
                    'platform.social_links',
                    links.map((item, i) =>
                      i === index ? { ...item, url: event.target.value } : item,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                aria-label={`Remove link ${index + 1}`}
                onClick={() =>
                  form.set(
                    'platform.social_links',
                    links.filter((_, i) => i !== index),
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))}
          {form.errors['platform.social_links'] ? (
            <p className="adm-field__error" role="alert">
              {form.errors['platform.social_links']}
            </p>
          ) : null}
          {links.length < 6 ? (
            <div>
              <Button
                variant="secondary"
                icon="plus"
                onClick={() =>
                  form.set('platform.social_links', [...links, { label: '', url: '' }])
                }
              >
                Add a link
              </Button>
            </div>
          ) : null}
        </fieldset>
        <FormActions
          dirty={form.dirty}
          busy={form.busy}
          onSave={() => void save()}
          onDiscard={form.discard}
          failure={form.failure}
        />
      </div>
    </Card>
  );
}

function HomeTab({ data, actions, onSaved }: TabProps) {
  const toast = useToast();
  const form = useSettingsForm({
    keys: HOME_KEYS,
    data,
    update: actions.update,
    onSaved,
    rules: HOME_NUMBERS,
  });
  const [text, setText] = useState<Record<string, string>>({});
  const numberText = (key: SettingKey) =>
    key in text ? text[key]! : String(form.draft[key] ?? '');

  function changeNumber(key: SettingKey, raw: string) {
    setText((current) => ({ ...current, [key]: raw }));
    const number = raw.trim() === '' ? Number.NaN : Number(raw);
    form.set(key, Number.isFinite(number) ? number : Number.NaN);
  }

  async function save() {
    if (await form.save()) {
      setText({});
      toast.show({ message: 'Home settings saved. They apply within a minute.', tone: 'success' });
    }
  }

  return (
    <Card title="Home">
      <div className="adm-stack">
        <div className="ads-flags">
          {HOME_FLAGS.map((key) => {
            const locked = SETTING_DEFS[key].tier === 'super' && !data.canChangeFlags;
            return (
              <div className="ads-flag" key={key}>
                <div>
                  <span className="adm-field__label">{label(key)}</span>
                  <p className="adm-field__hint">{hint(key)}</p>
                </div>
                <Switch
                  label={label(key)}
                  checked={form.draft[key] === true}
                  disabled={locked}
                  onChange={(value) => form.set(key, value)}
                />
              </div>
            );
          })}
        </div>
        <div className="ads-numbers">
          {(Object.keys(HOME_NUMBERS) as SettingKey[]).map((key) => (
            <TextField
              key={key}
              label={label(key)}
              hint={hint(key)}
              inputMode="numeric"
              value={numberText(key)}
              error={form.errors[key]}
              onChange={(event) => changeNumber(key, event.target.value)}
            />
          ))}
          {HOME_TEXTS.map((key) => (
            <TextField
              key={key}
              label={label(key)}
              hint={hint(key)}
              value={String(form.draft[key] ?? '')}
              error={form.errors[key]}
              onChange={(event) => form.set(key, event.target.value)}
            />
          ))}
        </div>
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
      </div>
    </Card>
  );
}

function FeaturesTab({ data, actions, onSaved }: TabProps) {
  const toast = useToast();
  const readOnly = !data.canChangeFlags;
  const form = useSettingsForm({
    keys: [...FLAG_KEYS, ...NUMBER_KEYS],
    data,
    update: actions.update,
    onSaved,
    rules: NUMBER_RULES,
  });
  const [text, setText] = useState<Record<string, string>>({});

  const shown = (key: SettingKey) => {
    if (key in text) return text[key]!;
    const value = form.draft[key];
    const unit = NUMBER_RULES[key]?.unit ?? 1;
    return typeof value === 'number' ? String(Math.round((value / unit) * 100) / 100) : '';
  };

  function change(key: SettingKey, raw: string) {
    setText((current) => ({ ...current, [key]: raw }));
    const unit = NUMBER_RULES[key]?.unit ?? 1;
    const number = raw.trim() === '' ? Number.NaN : Number(raw);
    form.set(key, Number.isFinite(number) ? Math.round(number * unit) : Number.NaN);
  }

  async function save() {
    if (await form.save()) {
      setText({});
      toast.show({
        message: 'Features and limits saved. They apply within a minute.',
        tone: 'success',
      });
    }
  }

  return (
    <Card
      title="Features and limits"
      aside={
        <Badge tone="neutral" icon="lock">
          Super admin only
        </Badge>
      }
    >
      {readOnly ? (
        <Banner tone="info">You can see these settings but not change them.</Banner>
      ) : null}
      <div className="adm-stack">
        <div className="ads-flags">
          {FLAG_KEYS.map((key) => (
            <div className="ads-flag" key={key}>
              <div>
                <span className="adm-field__label">{label(key)}</span>
                <p className="adm-field__hint">{hint(key)}</p>
              </div>
              <Switch
                label={label(key)}
                checked={form.draft[key] === true}
                disabled={readOnly}
                onChange={(value) => form.set(key, value)}
              />
            </div>
          ))}
        </div>
        <div className="ads-numbers">
          {NUMBER_KEYS.map((key) => (
            <TextField
              key={key}
              label={`${label(key)}${NUMBER_RULES[key]?.unit === GIB ? ' (GB)' : ''}`}
              hint={hint(key)}
              inputMode="decimal"
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

function MaintenanceTab({ data, actions, onSaved }: TabProps) {
  const toast = useToast();
  const form = useSettingsForm({ keys: MAINTENANCE_KEYS, data, update: actions.update, onSaved });
  const [confirm, setConfirm] = useState(false);
  const banner = form.draft['maintenance.banner'] as {
    enabled: boolean;
    message: string;
    startsAt: string | null;
    endsAt: string | null;
  };
  const mode = form.draft['maintenance.mode'] === true;
  const setBanner = (patch: Partial<typeof banner>) =>
    form.set('maintenance.banner', { ...banner, ...patch });
  const turningOn = mode && data.values['maintenance.mode'] !== true;

  async function commit() {
    setConfirm(false);
    if (await form.save()) toast.show({ message: 'Maintenance settings saved.', tone: 'success' });
  }

  return (
    <Card title="Maintenance">
      <div className="adm-stack">
        <div className="ads-flag">
          <div>
            <span className="adm-field__label">{label('maintenance.banner')}</span>
            <p className="adm-field__hint">{hint('maintenance.banner')}</p>
          </div>
          <Switch
            label="Show the notice banner"
            checked={banner.enabled}
            onChange={(value) => setBanner({ enabled: value })}
          />
        </div>
        <TextField
          label="Banner message"
          value={banner.message}
          maxLength={200}
          error={form.errors['maintenance.banner']}
          onChange={(event) => setBanner({ message: event.target.value })}
          hint="Short and plain, for example: Short break tonight from 11pm to 12am."
        />
        <div className="ads-flag">
          <div>
            <span className="adm-field__label">{label('maintenance.mode')}</span>
            <p className="adm-field__hint">{hint('maintenance.mode')}</p>
          </div>
          <Switch
            label="Maintenance mode"
            checked={mode}
            onChange={(value) => form.set('maintenance.mode', value)}
          />
        </div>
        <FormActions
          dirty={form.dirty}
          busy={form.busy}
          onSave={() => (turningOn ? setConfirm(true) : void commit())}
          onDiscard={form.discard}
          failure={form.failure}
        />
      </div>
      <ConfirmDialog
        open={confirm}
        title="Turn on maintenance mode?"
        consequence="Viewers will see a maintenance page instead of the site. Admins can still sign in. Videos that are playing are not interrupted."
        confirmLabel="Turn on"
        danger
        busy={form.busy}
        onConfirm={() => void commit()}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}
