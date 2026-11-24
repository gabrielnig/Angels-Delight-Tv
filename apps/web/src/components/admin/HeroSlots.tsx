'use client';

import { MAX_HERO_TEXT, setHeroText } from '@/lib/data/admin/home-rules';
import type { HeroText, HomeConfig } from '@/lib/data/admin/home-rules';
import type { VideoRecord } from '@/lib/data/admin/types';
import { TextField } from './fields';

const FIELDS = [
  { key: 'headline', label: 'Headline', hint: 'Leave blank to use the title.' },
  { key: 'blurb', label: 'Description', hint: 'Leave blank to use the title description.' },
  { key: 'buttonLabel', label: 'Button label', hint: 'Leave blank to use Play.' },
] as const satisfies readonly { key: keyof HeroText; label: string; hint: string }[];

interface Props {
  config: HomeConfig;
  videos: VideoRecord[];
  canCurate: boolean;
  onChange(config: HomeConfig): void;
}

/** Optional words for each hero slide. The slide falls back to the title's own text where a field is blank. */
export function HeroSlots({ config, videos, canCurate, onChange }: Props) {
  if (config.heroIds.length === 0) return null;
  return (
    <div className="adm-stack">
      {config.heroIds.map((id) => {
        const title = videos.find((v) => v.id === id)?.title ?? 'Removed video';
        const text = config.heroText?.[id] ?? {};
        return (
          <fieldset key={id} className="adm-fieldset" disabled={!canCurate}>
            <legend>Slide text for {title}</legend>
            {FIELDS.map((f) => (
              <TextField
                key={f.key}
                label={`${f.label} for ${title}`}
                value={text[f.key] ?? ''}
                hint={f.hint}
                aside={`${(text[f.key] ?? '').length} of ${MAX_HERO_TEXT}`}
                maxLength={MAX_HERO_TEXT}
                disabled={!canCurate}
                onChange={(e) => {
                  const next = { ...text, [f.key]: e.target.value };
                  const result = setHeroText(config, id, next);
                  if (result.ok) onChange(result.config);
                }}
              />
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
