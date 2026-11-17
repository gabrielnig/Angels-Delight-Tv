'use client';

import { themeVariables } from '@ad/ui';
import { FONT_OPTIONS } from '@ad/theme/client';
import type { FontKey } from '@ad/ui';

const SAMPLE = 'Aa Ọ ẹ ṣ ń';

/** Curated list (D-007) as radio cards. Each sample renders in its own family. */
export function FontPicker({
  value,
  onChange,
  readOnly,
}: {
  value: FontKey;
  onChange: (key: FontKey) => void;
  readOnly?: boolean;
}) {
  return (
    <fieldset className="adt-fonts" disabled={readOnly}>
      <legend className="adm-h3">Fonts</legend>
      <div className="adt-fonts__list">
        {FONT_OPTIONS.map((font) => {
          const stack = themeVariables({ fontKey: font.key })['--font-sans'];
          return (
            <label key={font.key} className={`adt-font${value === font.key ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="font"
                value={font.key}
                checked={value === font.key}
                onChange={() => onChange(font.key)}
              />
              <span className="adt-font__body">
                <span className="adt-font__name">{font.label}</span>
                <span className="adt-font__desc">{font.description}</span>
              </span>
              <span className="adt-font__sample" style={{ fontFamily: stack }} aria-hidden="true">
                {SAMPLE}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
