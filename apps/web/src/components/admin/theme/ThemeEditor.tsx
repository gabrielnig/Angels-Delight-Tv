'use client';

/* eslint-disable @next/next/no-img-element -- logo previews are data urls, there is nothing to optimise */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COLOR_LABELS,
  COLOR_ORDER,
  DEFAULT_THEME,
  DENSITY_OPTIONS,
  RADIUS_OPTIONS,
  TYPE_SCALE_OPTIONS,
  evaluateTheme,
  themesEqual,
  type ThemeValues,
} from '@ad/theme/client';
import type { Density, FontKey, ThemeColorKey } from '@ad/ui';
import type { ActionResult, LogoDto, ThemeEditorDto } from '@/lib/data/admin/theme-types';
import { Button, LinkButton } from '../Button';
import { ConfirmDialog } from '../Dialog';
import { TextField } from '../fields';
import { Badge } from '../Badge';
import { Card, PageHeader } from '../PageHeader';
import { Banner } from '../states';
import { Tabs } from '../Tabs';
import { useToast } from '../Toast';
import { ColorField } from './ColorField';
import { FontPicker } from './FontPicker';
import { ThemePreview, type PreviewDevice, type PreviewScreen } from './ThemePreview';
import './theme.css';

export interface SaveArgs {
  theme: ThemeValues;
  logoAssetId: string | null;
  platformName: string;
}

export interface ThemeEditorActions {
  saveDraft(input: SaveArgs): Promise<ActionResult<ThemeEditorDto>>;
  publish(
    input: SaveArgs & { acknowledgeWarnings?: boolean },
  ): Promise<ActionResult<ThemeEditorDto>>;
  reset(): Promise<ActionResult<ThemeEditorDto>>;
  uploadLogo(formData: FormData): Promise<ActionResult<LogoDto>>;
}

type Busy = 'save' | 'publish' | 'reset' | 'logo' | null;
type Dialog = 'reset' | 'publish' | null;

const MAX_LOGO_BYTES = 500 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const formatTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Lagos',
      }).format(new Date(iso))
    : null;

function indexOf<T extends { value: unknown }>(options: readonly T[], value: unknown): number {
  const found = options.findIndex((option) => option.value === value);
  return found >= 0 ? found : 0;
}

export function ThemeEditor({
  initial,
  actions,
  historyHref = '/admin/theme/history',
  readOnly = false,
}: {
  initial: ThemeEditorDto;
  actions: ThemeEditorActions;
  historyHref?: string;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [theme, setTheme] = useState<ThemeValues>(initial.theme);
  const [name, setName] = useState(initial.platformName);
  const [logo, setLogo] = useState<LogoDto | null>(initial.logo);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Busy>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [logoError, setLogoError] = useState<string | null>(null);
  const [screen, setScreen] = useState<PreviewScreen>('home');
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const fileRef = useRef<HTMLInputElement>(null);

  const gate = useMemo(() => evaluateTheme(theme), [theme]);
  const dirty =
    !themesEqual(theme, saved.theme) ||
    name !== saved.platformName ||
    (logo?.assetId ?? null) !== (saved.logo?.assetId ?? null);
  const hasInvalid = invalid.size > 0;
  const nameMissing = name.trim() === '';

  const blockedReason = hasInvalid
    ? 'Fix the colour that is not a valid hex value.'
    : gate.blocked
      ? 'Fix the colours that are too hard to read.'
      : nameMissing
        ? 'Enter a platform name.'
        : undefined;
  const saveReason = blockedReason ?? (dirty ? undefined : 'No changes to save.');
  const publishReason =
    blockedReason ?? (dirty || saved.hasDraft ? undefined : 'This theme is already published.');

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const setValidity = useCallback((key: string, valid: boolean) => {
    setInvalid((current) => {
      if (valid === !current.has(key)) return current;
      const next = new Set(current);
      if (valid) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const setColor = (key: ThemeColorKey, hex: string) =>
    setTheme((current) => ({ ...current, colors: { ...current.colors, [key]: hex } }));

  function apply(data: ThemeEditorDto) {
    setSaved(data);
    setTheme(data.theme);
    setName(data.platformName);
    setLogo(data.logo);
    setInvalid(new Set());
  }

  function failure(result: Extract<ActionResult<unknown>, { ok: false }>) {
    setError(result.message);
    if (result.fields?.['platform.name']) setNameError(result.fields['platform.name'][0]);
  }

  const args = (): SaveArgs => ({
    theme,
    logoAssetId: logo?.assetId ?? null,
    platformName: name.trim(),
  });

  async function saveDraft() {
    setBusy('save');
    setError(null);
    setNameError(undefined);
    const result = await actions.saveDraft(args());
    setBusy(null);
    if (result.ok) {
      apply(result.data);
      toast.show({ message: 'Draft saved.', tone: 'success' });
    } else failure(result);
  }

  async function publish() {
    setBusy('publish');
    setError(null);
    const result = await actions.publish({
      ...args(),
      acknowledgeWarnings: gate.requiresAcknowledgement,
    });
    setBusy(null);
    setDialog(null);
    if (result.ok) {
      apply(result.data);
      toast.show({
        message: `Theme published. Viewers will see the new look on their next page load. Version ${result.data.publishedVersion} is saved in history.`,
        tone: 'success',
      });
    } else failure(result);
  }

  async function reset() {
    setBusy('reset');
    setError(null);
    const result = await actions.reset();
    setBusy(null);
    setDialog(null);
    if (result.ok) {
      apply(result.data);
      toast.show({
        message: 'Theme reset to the defaults. Publish when you are ready.',
        tone: 'info',
      });
    } else failure(result);
  }

  async function chooseLogo(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError('Use a PNG, JPEG or WebP image. SVG files are not accepted.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('The image is larger than 500 KB. Use a smaller file.');
      return;
    }
    setBusy('logo');
    const form = new FormData();
    form.set('file', file);
    form.set('altText', `${name.trim() || 'Platform'} logo`);
    const result = await actions.uploadLogo(form);
    setBusy(null);
    if (result.ok) setLogo(result.data);
    else setLogoError(result.fields?.file?.[0] ?? result.message);
  }

  const warnCount = gate.warnings.length;
  const status = dirty ? (
    <Badge tone="warning" icon="alert">
      Unsaved changes
    </Badge>
  ) : saved.hasDraft ? (
    <span className="adm-muted">Draft saved {formatTime(saved.draftSavedAt)}</span>
  ) : (
    <span className="adm-muted">
      {saved.publishedVersion
        ? `Published version ${saved.publishedVersion}`
        : 'Using the default theme'}
    </span>
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Theme' }]}
        title="Theme settings"
        lead="Colours, fonts, sizes and logo for the viewer site"
        actions={
          <LinkButton href={historyHref} icon="clock">
            Theme history
          </LinkButton>
        }
      />

      <div className="adt-toolbar">
        <div className="adt-toolbar__status" aria-live="polite">
          {status}
        </div>
        <div className="adt-toolbar__actions">
          <Button
            variant="ghost"
            onClick={() => setDialog('reset')}
            disabled={readOnly || busy !== null}
          >
            Reset to default
          </Button>
          <Button
            variant="secondary"
            loading={busy === 'save'}
            disabledReason={readOnly ? 'You can view the theme but not change it.' : saveReason}
            onClick={saveDraft}
          >
            Save draft
          </Button>
          <Button
            variant="primary"
            loading={busy === 'publish'}
            disabledReason={readOnly ? 'You can view the theme but not change it.' : publishReason}
            onClick={() => setDialog('publish')}
          >
            Publish theme
          </Button>
        </div>
      </div>

      {error ? (
        <Banner
          tone="danger"
          action={
            <Button variant="secondary" onClick={() => setError(null)}>
              Dismiss
            </Button>
          }
        >
          <strong>Your changes are still here.</strong> {error}
        </Banner>
      ) : null}

      {gate.blocked ? (
        <Banner tone="danger">
          <strong>This colour cannot be saved.</strong>
          <ul className="adt-issues">
            {gate.blockers.map((check) => (
              <li key={check.id}>
                {check.message}{' '}
                {check.suggestion ? (
                  <Button
                    variant="ghost"
                    onClick={() => setColor(check.suggestion!.field, check.suggestion!.value)}
                  >
                    {`Use suggested ${check.suggestion.value}`}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Banner>
      ) : warnCount > 0 ? (
        <Banner tone="warning">
          <strong>{`Low contrast on ${warnCount} ${warnCount === 1 ? 'pair' : 'pairs'}.`}</strong>
          <ul className="adt-issues">
            {gate.warnings.map((check) => (
              <li key={check.id}>
                {check.message}{' '}
                {check.suggestion ? (
                  <Button
                    variant="ghost"
                    onClick={() => setColor(check.suggestion!.field, check.suggestion!.value)}
                  >
                    {`Use suggested ${check.suggestion.value}`}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Banner>
      ) : null}

      <div className="adt-layout">
        <div className="adt-controls">
          <Card
            title="Colours"
            aside={<span className="adm-muted">Ratios use WCAG 2.2, 4.5:1 needed for text</span>}
          >
            <div className="adt-colors">
              {COLOR_ORDER.map((key) => (
                <ColorField
                  key={key}
                  name={`color-${key}`}
                  label={COLOR_LABELS[key].label}
                  hint={COLOR_LABELS[key].hint}
                  value={theme.colors[key]}
                  onChange={(hex) => setColor(key, hex)}
                  onValidity={(valid) => setValidity(key, valid)}
                  check={gate.byField[key]}
                  decorative={key === 'border'}
                  onReset={
                    theme.colors[key] === DEFAULT_THEME.colors[key]
                      ? undefined
                      : () => setColor(key, DEFAULT_THEME.colors[key])
                  }
                  readOnly={readOnly}
                />
              ))}
            </div>
          </Card>

          <Card>
            <FontPicker
              value={theme.fontKey}
              onChange={(fontKey: FontKey) => setTheme((c) => ({ ...c, fontKey }))}
              readOnly={readOnly}
            />
          </Card>

          <Card title="Sizes">
            <SizeSlider
              label="Base text size"
              options={TYPE_SCALE_OPTIONS}
              value={theme.typeScale}
              onChange={(typeScale) => setTheme((c) => ({ ...c, typeScale }))}
              onReset={() => setTheme((c) => ({ ...c, typeScale: DEFAULT_THEME.typeScale }))}
              isDefault={theme.typeScale === DEFAULT_THEME.typeScale}
              readOnly={readOnly}
            />
            <SizeSlider
              label="Corner roundness"
              options={RADIUS_OPTIONS}
              value={theme.radiusScale}
              onChange={(radiusScale) => setTheme((c) => ({ ...c, radiusScale }))}
              onReset={() => setTheme((c) => ({ ...c, radiusScale: DEFAULT_THEME.radiusScale }))}
              isDefault={theme.radiusScale === DEFAULT_THEME.radiusScale}
              readOnly={readOnly}
            />
            <fieldset className="adt-density" disabled={readOnly}>
              <legend className="adm-field__label">Spacing</legend>
              <div className="adt-density__list" role="radiogroup" aria-label="Spacing">
                {DENSITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`adt-density__item${theme.density === option.value ? ' is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="density"
                      value={option.value}
                      checked={theme.density === option.value}
                      onChange={() => setTheme((c) => ({ ...c, density: option.value as Density }))}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card title="Logo and name">
            <div className="adt-logo">
              <div className="adt-logo__current">
                {logo ? (
                  <>
                    <span className="adt-logo__sample adt-logo__sample--light">
                      <img
                        src={logo.dataUrl}
                        alt={logo.altText ?? 'Current logo on a light background'}
                      />
                    </span>
                    <span className="adt-logo__sample adt-logo__sample--dark">
                      <img src={logo.dataUrl} alt="Current logo on a dark background" />
                    </span>
                  </>
                ) : (
                  <p className="adm-muted">No logo yet. The platform name shows as text.</p>
                )}
              </div>
              <div className="adm-row">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="adm-sr"
                  aria-label="Logo file"
                  tabIndex={-1}
                  onChange={(event) => {
                    void chooseLogo(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
                <Button
                  variant="secondary"
                  icon="upload"
                  loading={busy === 'logo'}
                  disabled={readOnly}
                  onClick={() => fileRef.current?.click()}
                >
                  {logo ? 'Replace logo' : 'Upload logo'}
                </Button>
                {logo ? (
                  <Button variant="ghost" disabled={readOnly} onClick={() => setLogo(null)}>
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="adm-field__hint">
                PNG, JPEG or WebP, up to 500 KB. Shown on a light and a dark background.
              </p>
              {logoError ? (
                <p className="adm-field__error" role="alert">
                  {logoError}
                </p>
              ) : null}
            </div>
            <TextField
              label="Platform name"
              value={name}
              maxLength={60}
              readOnly={readOnly}
              onChange={(event) => setName(event.target.value)}
              error={nameError ?? (nameMissing ? 'Platform name is required' : undefined)}
              hint="Updates the header, page titles and emails when you save."
            />
          </Card>
        </div>

        <div className="adt-previewcol">
          <Card title="Live preview" aside={<span className="adm-muted">Updates as you type</span>}>
            <div className="adt-previewbar">
              <Tabs
                label="Preview screen"
                value={screen}
                onChange={(id) => setScreen(id as PreviewScreen)}
                tabs={[
                  { id: 'home', label: 'Home' },
                  { id: 'watch', label: 'Watch' },
                  { id: 'signin', label: 'Sign in' },
                ]}
              >
                <ThemePreview
                  theme={theme}
                  platformName={name || 'Platform name'}
                  logo={logo}
                  screen={screen}
                  device={device}
                />
              </Tabs>
              <div className="adt-device" role="group" aria-label="Preview size">
                {(['desktop', 'mobile'] as const).map((value) => (
                  <Button
                    key={value}
                    variant={device === value ? 'primary' : 'secondary'}
                    aria-pressed={device === value}
                    onClick={() => setDevice(value)}
                  >
                    {value === 'desktop' ? 'Desktop' : 'Mobile'}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'reset'}
        title="Reset theme to default?"
        consequence="This sets all colours, fonts, sizes and the logo back to the Angels Delight TV defaults. Your current draft will be lost. Published history stays, so you can restore it later."
        confirmLabel="Reset to default"
        busy={busy === 'reset'}
        onConfirm={reset}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'publish'}
        title={warnCount > 0 ? 'Publish with low contrast?' : 'Publish this theme?'}
        consequence="Viewers will see the new look on their next page load. The previous version stays in history."
        confirmLabel={warnCount > 0 ? 'Publish anyway' : 'Publish theme'}
        busy={busy === 'publish'}
        onConfirm={publish}
        onClose={() => setDialog(null)}
      >
        {warnCount > 0 ? (
          <ul className="adt-issues">
            {gate.warnings.map((check) => (
              <li key={check.id}>{check.message}</li>
            ))}
          </ul>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

function SizeSlider({
  label,
  options,
  value,
  onChange,
  onReset,
  isDefault,
  readOnly,
}: {
  label: string;
  options: readonly { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
  onReset: () => void;
  isDefault: boolean;
  readOnly?: boolean;
}) {
  const index = indexOf(options, value);
  const current = options[index]!;
  return (
    <div className="adt-size">
      <div className="adm-field__head">
        <label className="adm-field__label" htmlFor={`size-${label}`}>
          {label}
        </label>
        <span className="adt-size__value">{current.label}</span>
      </div>
      <div className="adm-row">
        <input
          id={`size-${label}`}
          type="range"
          min={0}
          max={options.length - 1}
          step={1}
          value={index}
          disabled={readOnly}
          aria-valuetext={current.label}
          onChange={(event) => onChange(options[Number(event.target.value)]!.value)}
          className="adt-size__range"
        />
        {isDefault ? null : (
          <Button variant="ghost" onClick={onReset} aria-label={`Reset ${label} to the default`}>
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
