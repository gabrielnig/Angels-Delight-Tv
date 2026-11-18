'use client';

import { THEME_PRESETS, type ThemePreset, type ThemeValues } from '@ad/theme/client';

const same = (a: ThemeValues['colors'], b: ThemeValues['colors']) =>
  (Object.keys(a) as (keyof typeof a)[]).every((k) => a[k].toLowerCase() === b[k].toLowerCase());

/** Ready themes as radio cards. Picking one fills the colours only, the admin can still change anything. */
export function PresetPicker({
  colors,
  onPick,
  readOnly,
}: {
  colors: ThemeValues['colors'];
  onPick: (preset: ThemePreset) => void;
  readOnly?: boolean;
}) {
  const current = THEME_PRESETS.find((p) => same(p.theme.colors, colors));
  return (
    <fieldset className="adt-fonts" disabled={readOnly}>
      <legend className="adm-h3">Ready made themes</legend>
      <div className="adt-fonts__list">
        {THEME_PRESETS.map((preset) => (
          <label
            key={preset.key}
            className={`adt-font${current?.key === preset.key ? ' is-selected' : ''}`}
          >
            <input
              type="radio"
              name="preset"
              value={preset.key}
              checked={current?.key === preset.key}
              onChange={() => onPick(preset)}
            />
            <span className="adt-font__body">
              <span className="adt-font__name">{preset.label}</span>
              <span className="adt-font__desc">{preset.description}</span>
            </span>
            <span className="adt-swatches" aria-hidden="true">
              {(['bg', 'primary', 'accent'] as const).map((k) => (
                <span key={k} className="adt-swatch" style={{ background: preset.theme.colors[k] }} />
              ))}
            </span>
          </label>
        ))}
      </div>
      {current ? null : <p className="adm-muted">Custom colours. Pick a theme to start again from one.</p>}
    </fieldset>
  );
}
