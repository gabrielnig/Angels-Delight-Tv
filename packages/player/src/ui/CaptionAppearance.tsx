'use client';

import { usePlayerT } from '../t';
import { useState, type CSSProperties } from 'react';
import {
  DEFAULT_CAPTION_STYLE,
  captionStyleVars,
  type CaptionBackground,
  type CaptionContrast,
  type CaptionEdge,
  type CaptionSize,
  type CaptionStyle,
} from '../captionStyle';
import { CheckIcon } from './icons';
import { MenuShell } from './Menus';

interface Option<T extends string> {
  value: T;
  label: string;
}

const SIZES: Option<CaptionSize>[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra large' },
];
const BACKGROUNDS: Option<CaptionBackground>[] = [
  { value: 'none', label: 'None' },
  { value: 'dark', label: 'Dark' },
  { value: 'solid', label: 'Solid' },
];
const CONTRASTS: Option<CaptionContrast>[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
];
const EDGES: Option<CaptionEdge>[] = [
  { value: 'none', label: 'None' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'outline', label: 'Outline' },
];

interface GroupProps<T extends string> {
  name: string;
  options: Option<T>[];
  value: T;
  note?: string | undefined;
  onPick(option: Option<T>): void;
}

function Group<T extends string>({ name, options, value, note, onPick }: GroupProps<T>) {
  return (
    <div role="group" aria-label={name} className="adp-capstyle__group">
      <p className="adp-menu__section" aria-hidden="true">
        {name}
      </p>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="menuitemradio"
          aria-checked={value === o.value}
          aria-label={`${name}, ${o.label}`}
          className="adp-menu__row"
          onClick={() => onPick(o)}
        >
          <span className="adp-menu__check" aria-hidden="true">
            {value === o.value ? <CheckIcon size={16} /> : null}
          </span>
          <span>{o.label}</span>
        </button>
      ))}
      {note ? <p className="adp-menu__note">{note}</p> : null}
    </div>
  );
}

/**
 * Caption size, background, contrast and edge with a live preview (L4-07). Edge None on a clear background is
 * drawn as Shadow (L4-D19), and the panel says so instead of leaving the viewer guessing.
 */
export function CaptionAppearance({
  style,
  onChange,
  onClose,
}: {
  style: CaptionStyle;
  onChange(style: CaptionStyle): void;
  onClose(): void;
}) {
  const msg = usePlayerT();
  const [announced, setAnnounced] = useState('');
  const change = (group: string, label: string, next: CaptionStyle) => {
    setAnnounced(msg('player.captionStyle.changed', { group, value: label }));
    onChange(next);
  };
  const sizeName = msg('player.captionStyle.size');
  const backgroundName = msg('player.captionStyle.background');
  const contrastName = msg('player.captionStyle.contrast');
  const edgeName = msg('player.captionStyle.edge');
  const corrected = style.background === 'none' && style.edge === 'none';
  return (
    <MenuShell
      id="adp-menu-captionstyle"
      label={msg('player.captionStyle.title')}
      onClose={onClose}
    >
      <div
        className="adp-capstyle__preview"
        data-testid="caption-appearance-preview"
        style={captionStyleVars(style) as CSSProperties}
      >
        <span className="adp-capstyle__sample">{msg('player.captionStyle.preview')}</span>
      </div>
      <Group
        name={sizeName}
        options={SIZES}
        value={style.size}
        onPick={(o) => change(sizeName, o.label, { ...style, size: o.value })}
      />
      <Group
        name={backgroundName}
        options={BACKGROUNDS}
        value={style.background}
        onPick={(o) => change(backgroundName, o.label, { ...style, background: o.value })}
      />
      <Group
        name={contrastName}
        options={CONTRASTS}
        value={style.contrast}
        onPick={(o) => change(contrastName, o.label, { ...style, contrast: o.value })}
      />
      <Group
        name={edgeName}
        options={EDGES}
        value={style.edge}
        note={corrected ? msg('player.captionStyle.edgeAuto') : undefined}
        onPick={(o) => change(edgeName, o.label, { ...style, edge: o.value })}
      />
      <button
        type="button"
        role="menuitem"
        className="adp-menu__row"
        onClick={() => {
          setAnnounced(msg('player.captionStyle.reset'));
          onChange({ ...DEFAULT_CAPTION_STYLE });
        }}
      >
        {msg('player.captionStyle.reset')}
      </button>
      <p className="adp-sr" role="status">
        {announced}
      </p>
    </MenuShell>
  );
}
