'use client';

import { useState } from 'react';
import { SPONSOR_SLOTS, type SponsorSlot } from '@ad/shared';
import { Button } from './Button';
import { ConfirmDialog } from './Dialog';
import { Checkbox, TextArea, TextField } from './fields';
import { SLOT_LABELS } from './sponsor-labels';
import { useCommand } from './useCommand';

export interface CreativeView {
  id: string;
  headline: string;
  body: string | null;
  ctaLabel: string;
  destinationUrl: string;
  altText: string | null;
  weight: number;
  active: boolean;
  slots: SponsorSlot[];
  imageSquareAssetId: string | null;
  imageWideAssetId: string | null;
}

type R = { ok: true } | { ok: false; error: string; fields?: Record<string, string[]> };
export interface CreativeActions {
  add(sponsorId: string, body: CreativeBody, slots: string[]): Promise<R>;
  update(id: string, body: CreativeBody, slots: string[]): Promise<R>;
  remove(id: string): Promise<R>;
  upload(form: FormData): Promise<{ ok: true; assetId: string } | { ok: false; error: string }>;
}
interface CreativeBody {
  headline: string;
  body: string;
  ctaLabel: string;
  destinationUrl: string;
  altText: string;
  decorative: boolean;
  weight: number;
  hasImage: boolean;
  imageSquareAssetId: string | null;
  imageWideAssetId: string | null;
}

function CreativeForm({
  sponsorId,
  creative,
  actions,
  onDone,
}: {
  sponsorId: string;
  creative?: CreativeView;
  actions: CreativeActions;
  onDone: () => void;
}) {
  const { run, busy } = useCommand();
  const [v, setV] = useState({
    headline: creative?.headline ?? '',
    body: creative?.body ?? '',
    ctaLabel: creative?.ctaLabel ?? 'Learn more',
    destinationUrl: creative?.destinationUrl ?? '',
    altText: creative?.altText ?? '',
    weight: creative?.weight ?? 1,
  });
  const [slots, setSlots] = useState<SponsorSlot[]>(creative?.slots ?? []);
  const [square, setSquare] = useState<string | null>(creative?.imageSquareAssetId ?? null);
  const [wide, setWide] = useState<string | null>(creative?.imageWideAssetId ?? null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [uploadError, setUploadError] = useState<string>();
  const err = (k: string) => fields[k]?.[0];
  const text = (k: 'headline' | 'body' | 'ctaLabel' | 'destinationUrl' | 'altText') => (e: { target: { value: string } }) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  async function pick(kind: 'square' | 'wide', file: File | undefined) {
    if (!file) return;
    setUploadError(undefined);
    const form = new FormData();
    form.set('file', file);
    form.set('kind', kind);
    const r = await actions.upload(form);
    if (!r.ok) return setUploadError(r.error);
    (kind === 'square' ? setSquare : setWide)(r.assetId);
  }

  async function save() {
    setFields({});
    const body: CreativeBody = {
      ...v,
      decorative: !v.altText.trim() && Boolean(square || wide),
      hasImage: Boolean(square || wide),
      imageSquareAssetId: square,
      imageWideAssetId: wide,
    };
    const r = await run(async () => {
      const out = creative ? await actions.update(creative.id, body, slots) : await actions.add(sponsorId, body, slots);
      if (!out.ok) {
        setFields(out.fields ?? {});
        return { ok: false as const, error: out.error };
      }
      return { ok: true as const };
    }, 'Creative saved.');
    if (r.ok) onDone();
  }

  return (
    <form
      className="adm-card adm-stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <TextField label="Headline" value={v.headline} onChange={text('headline')} error={err('headline')} maxLength={60} />
      <TextArea label="Short text" value={v.body} onChange={text('body')} error={err('body')} rows={2} />
      <TextField label="Button label" value={v.ctaLabel} onChange={text('ctaLabel')} error={err('ctaLabel')} />
      <TextField label="Link" type="url" value={v.destinationUrl} onChange={text('destinationUrl')} error={err('destinationUrl')} hint="The sponsor's own website." />
      <div className="adm-row">
        <label className="adm-field__label">
          Square picture
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void pick('square', e.target.files?.[0])} />
        </label>
        <label className="adm-field__label">
          Wide picture
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void pick('wide', e.target.files?.[0])} />
        </label>
      </div>
      {square || wide ? <p className="adm-muted">Picture added. It is processed in the background.</p> : null}
      {uploadError ? <p className="adm-field__error" role="alert">{uploadError}</p> : null}
      <TextField label="Picture description" value={v.altText} onChange={text('altText')} error={err('altText')} hint="Read aloud by screen readers. Leave empty only if the picture adds nothing." />
      <fieldset className="adm-stack">
        <legend className="adm-field__label">Where it shows</legend>
        {SPONSOR_SLOTS.map((slot) => (
          <Checkbox
            key={slot}
            label={SLOT_LABELS[slot]}
            checked={slots.includes(slot)}
            onChange={(e) => setSlots((cur) => (e.target.checked ? [...cur, slot] : cur.filter((s) => s !== slot)))}
          />
        ))}
        {err('slots') ? <p className="adm-field__error" role="alert">{err('slots')}</p> : null}
      </fieldset>
      <div className="adm-row">
        <Button variant="primary" type="submit" loading={busy}>Save creative</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function CreativesEditor({
  sponsorId,
  creatives,
  actions,
}: {
  sponsorId: string;
  creatives: CreativeView[];
  actions: CreativeActions;
}) {
  const { run, busy } = useCommand();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [removing, setRemoving] = useState<CreativeView | null>(null);
  return (
    <section className="adm-stack" aria-label="Creatives">
      <div className="adm-row">
        <Button variant="secondary" icon="plus" onClick={() => setEditing('new')}>Add creative</Button>
      </div>
      {editing === 'new' ? (
        <CreativeForm sponsorId={sponsorId} actions={actions} onDone={() => setEditing(null)} />
      ) : null}
      {creatives.map((c) =>
        editing === c.id ? (
          <CreativeForm key={c.id} sponsorId={sponsorId} creative={c} actions={actions} onDone={() => setEditing(null)} />
        ) : (
          <div key={c.id} className="adm-card adm-listrow">
            <div className="adm-listrow__main">
              <strong>{c.headline}</strong>
              <span className="adm-muted">{c.slots.length === 0 ? 'No placement ticked, never shown' : c.slots.map((s) => SLOT_LABELS[s]).join(', ')}</span>
              {SPONSOR_SLOTS.map((slot) => (
                <Checkbox key={slot} label={SLOT_LABELS[slot]} checked={c.slots.includes(slot)} readOnly disabled />
              ))}
            </div>
            <div className="adm-row">
              <Button variant="secondary" onClick={() => setEditing(c.id)}>Edit</Button>
              <Button variant="danger" aria-label="Remove creative" onClick={() => setRemoving(c)}>Remove</Button>
            </div>
          </div>
        ),
      )}
      <ConfirmDialog
        open={removing !== null}
        title="Remove this creative?"
        consequence="It stops showing at once. Report numbers already counted stay."
        confirmLabel="Remove"
        danger
        busy={busy}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          const r = await run(() => actions.remove(removing.id), 'Creative removed.');
          if (r.ok) setRemoving(null);
        }}
      />
    </section>
  );
}
