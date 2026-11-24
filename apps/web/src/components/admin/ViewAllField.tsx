'use client';

import { viewAllUrlProblem, type ViewAllMode } from '@ad/shared/view-all';
import { TextField } from './fields';

/**
 * Chooses how a section's View all link behaves: Automatic (shown in words), a Custom link, or None.
 * A bad custom link shows its message at once and the page blocks Publish until it is fixed (M41-S08).
 */
export function ViewAllField({
  mode,
  url,
  opens,
  disabled,
  onChange,
}: {
  mode: ViewAllMode;
  url: string;
  /** What an automatic link opens in words and path, or null when the section has no automatic target. */
  opens: string | null;
  disabled?: boolean;
  onChange: (mode: ViewAllMode, url: string) => void;
}) {
  const problem = mode === 'custom' && url.length > 0 ? viewAllUrlProblem(url) : null;
  const choices: Array<{ value: ViewAllMode; title: string; text: React.ReactNode }> = [
    {
      value: 'auto',
      title: 'Automatic',
      text: opens ? (
        <>
          Opens <strong>{opens}</strong>. Viewers see the words from Site settings.
        </>
      ) : (
        'This section has no list page, so no link is shown.'
      ),
    },
    { value: 'custom', title: 'Custom link', text: 'Use a path on this site or an https link.' },
    { value: 'none', title: 'None', text: 'No link is shown on this section.' },
  ];
  return (
    <fieldset className="adm-viewall" disabled={disabled}>
      <legend className="adm-field__label">View all link</legend>
      {choices.map((choice) => (
        <label key={choice.value} className={`adm-viewall__opt${mode === choice.value ? ' is-on' : ''}`}>
          <input
            type="radio"
            name="view-all-mode"
            checked={mode === choice.value}
            onChange={() => onChange(choice.value, choice.value === 'custom' ? url : '')}
          />
          <span>
            <strong>{choice.title}</strong>
            <span className="adm-muted">{choice.text}</span>
          </span>
        </label>
      ))}
      {mode === 'custom' ? (
        <TextField
          label="Link"
          value={url}
          placeholder="/browse/maths"
          inputMode="url"
          autoComplete="off"
          hint="For example /browse/maths."
          error={problem ?? undefined}
          onChange={(e) => onChange('custom', e.target.value.trim())}
        />
      ) : null}
    </fieldset>
  );
}
