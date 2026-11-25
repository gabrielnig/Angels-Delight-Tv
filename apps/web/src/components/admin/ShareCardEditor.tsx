'use client';

import { useState } from 'react';
import {
  PLATFORM_LIMITS,
  SHARE_DESCRIPTION_MAX,
  SHARE_TITLE_MAX,
  previewCards,
  shareTextOf,
  validateShareText,
  type PreviewPlatform,
} from '@/lib/seo/share-overrides';
import { Button } from './Button';
import { TextArea, TextField } from './fields';
import { useToast } from './Toast';

const NAMES: Record<PreviewPlatform, string> = { whatsapp: 'WhatsApp', facebook: 'Facebook', x: 'X' };

interface Props {
  title: string;
  description: string;
  siteName: string;
  origin: string | undefined;
  /** The share picture the title uses today (generated from its poster), as a path or https url. */
  imageUrl: string | null;
  initial: { title: string | null; description: string | null };
  save(input: { title: string; description: string }): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>;
}

/** Share title and description with live WhatsApp, Facebook and X cards (M45-S23). Empty fields follow the title. */
export function ShareCardEditor(props: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(props.initial.title ?? '');
  const [description, setDescription] = useState(props.initial.description ?? '');
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const check = validateShareText({ title, description });
  const errors = check.ok ? serverErrors : { ...serverErrors, ...check.errors };
  const shown = shareTextOf(
    { title: props.title, description: props.description },
    { title, description },
  );
  const cards = previewCards({
    ...shown,
    siteName: props.siteName,
    origin: props.origin,
    imageUrl: props.imageUrl,
  });

  async function onSave() {
    if (!check.ok) return;
    setSaving(true);
    const result = await props.save({ title, description });
    setSaving(false);
    if (result.ok) {
      setServerErrors({});
      toast.show({ message: 'Share card saved. Chat apps pick it up the next time the link is shared.', tone: 'success' });
    } else {
      setServerErrors(result.errors);
    }
  }

  return (
    <div className="adm-stack">
      <TextField
        label="Share title"
        hint={`Leave empty to use the title. Up to ${SHARE_TITLE_MAX} characters.`}
        value={title}
        error={errors.title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <TextArea
        label="Share description"
        hint={`Leave empty to use the description. Up to ${SHARE_DESCRIPTION_MAX} characters.`}
        rows={3}
        value={description}
        error={errors.description}
        aside={
          <span className="ads-counter" aria-live="polite">
            {description.length} of {SHARE_DESCRIPTION_MAX}
          </span>
        }
        onChange={(event) => setDescription(event.target.value)}
      />
      {errors.form ? <p role="alert" className="adm-field__error">{errors.form}</p> : null}
      <div className="ads-previews__grid" aria-label="Share previews">
        {cards.map((card) => (
          <section key={card.platform} aria-label={`${NAMES[card.platform]} preview`} className="ads-card">
            <p className="adm-field__label">{NAMES[card.platform]}</p>
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ads-card__img" src={card.imageUrl} alt="" width={1200} height={630} />
            ) : (
              <div className="ads-card__img ads-card__img--empty" aria-hidden="true" />
            )}
            <p className="ads-serp__url">{card.domain}</p>
            <p className="ads-card__title">{card.title}</p>
            <p className="ads-card__desc">{card.description}</p>
            {card.cut.title || card.cut.description ? (
              <p className="adm-field__hint">
                {NAMES[card.platform]} shows about {PLATFORM_LIMITS[card.platform].title} characters of the title
                and {PLATFORM_LIMITS[card.platform].description} of the description, so the end is cut.
              </p>
            ) : null}
          </section>
        ))}
      </div>
      <div>
        <Button variant="primary" onClick={onSave} disabled={saving || !check.ok}>
          {saving ? 'Saving' : 'Save share card'}
        </Button>
      </div>
    </div>
  );
}
