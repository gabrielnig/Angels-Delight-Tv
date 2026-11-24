'use client';

import type { Translate } from '@ad/shared/messages';
import { usePlayerT } from '../t';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { QualityMenu } from '../quality';
import { ChevronRightIcon } from './icons';
import { MenuRow, MenuShell, QualityRows, SpeedRows } from './Menus';

export interface AudioChoice {
  current: string;
  tracks: { id: string; label: string }[];
  onSelect(id: string): void;
}

export interface SettingsMenuProps {
  rate: number;
  onRate(rate: number): void;
  /** Null hides the row (a single rendition). */
  quality: QualityMenu | null;
  onQuality(selection: 'auto' | number): void;
  /** Shown under the quality list while Data saver is on. */
  dataSaverNote?: ReactNode;
  /** Only shown with more than one track. */
  audio?: AudioChoice | undefined;
  autoplayNext: boolean;
  /** A kids profile follows its grown up's choice. */
  autoplayLocked?: boolean | undefined;
  onAutoplay(on: boolean): void;
  /** Without a handler the row is not offered. */
  onCaptionStyle?: (() => void) | undefined;
  /** Desktop only. Without a handler the row is not offered. */
  onShortcuts?: (() => void) | undefined;
  /** Chapter rows, first in the bottom sheet. */
  chapters?: ReactNode;
  /** Opens straight on a submenu, for the slow connection hint. */
  initialView?: 'quality' | undefined;
  onClose(): void;
}

type View = 'root' | 'speed' | 'quality' | 'audio';

function speedValue(rate: number, msg: Translate): string {
  return rate === 1 ? msg('player.settings.normal') : `${rate}x`;
}

function NavRow({
  id,
  label,
  value,
  onOpen,
}: {
  id: string;
  label: string;
  value: string;
  onOpen(): void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      aria-label={`${label}, ${value}`}
      data-row={id}
      className="adp-menu__row adp-menu__row--nav"
      onClick={onOpen}
    >
      <span>{label}</span>
      <span className="adp-menu__value" aria-hidden="true">
        {value}
        <ChevronRightIcon size={16} />
      </span>
    </button>
  );
}

/**
 * One Settings panel in place of loose Speed and Quality buttons (L4-07). Rows show their current value and open
 * a submenu. Escape goes back one level with focus on the row that opened it, then closes. The same panel is
 * the bottom sheet on compact screens.
 */
export function SettingsMenu(props: SettingsMenuProps) {
  const msg = usePlayerT();
  const [view, setView] = useState<View>(
    props.initialView === 'quality' && props.quality ? 'quality' : 'root',
  );
  const returnTo = useRef<View | null>(props.initialView === 'quality' ? 'quality' : null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Back at the root, focus lands on the row that opened the submenu.
  useEffect(() => {
    if (view !== 'root' || returnTo.current === null) return;
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-row="${returnTo.current}"]`);
    returnTo.current = null;
    row?.focus();
  }, [view]);

  const open = (next: Exclude<View, 'root'>) => {
    returnTo.current = next;
    setView(next);
  };
  const back = () => setView('root');
  const backRow = (
    <button type="button" role="menuitem" className="adp-menu__row" onClick={back}>
      {msg('player.settings.back')}
    </button>
  );

  if (view === 'speed') {
    return (
      <MenuShell id="adp-menu-settings-speed" label={msg('player.menu.speed')} onClose={back}>
        {backRow}
        <SpeedRows
          rate={props.rate}
          onSelect={(r) => {
            props.onRate(r);
            props.onClose();
          }}
        />
      </MenuShell>
    );
  }

  if (view === 'quality' && props.quality) {
    return (
      <MenuShell
        id="adp-menu-settings-quality"
        label={msg('player.menu.quality')}
        onClose={back}
        footer={props.dataSaverNote}
      >
        {backRow}
        <QualityRows
          menu={props.quality}
          onSelect={(sel) => {
            props.onQuality(sel);
            props.onClose();
          }}
        />
      </MenuShell>
    );
  }

  const audio = props.audio && props.audio.tracks.length > 1 ? props.audio : null;
  if (view === 'audio' && audio) {
    return (
      <MenuShell id="adp-menu-settings-audio" label={msg('player.settings.audio')} onClose={back}>
        {backRow}
        {audio.tracks.map((t) => (
          <MenuRow
            key={t.id}
            label={t.label}
            checked={audio.current === t.id}
            onSelect={() => {
              audio.onSelect(t.id);
              props.onClose();
            }}
          />
        ))}
      </MenuShell>
    );
  }

  const locked = props.autoplayLocked === true;
  const autoplayName = locked
    ? `${msg('player.settings.autoplay')}. ${msg('player.settings.autoplayLocked')}`
    : msg('player.settings.autoplay');
  return (
    <div ref={rootRef}>
      <MenuShell
        id="adp-menu-settings"
        label={msg('player.settings')}
        onClose={props.onClose}
        footer={props.quality ? null : props.dataSaverNote}
      >
        {props.chapters}
        <NavRow
          id="speed"
          label={msg('player.menu.speed')}
          value={speedValue(props.rate, msg)}
          onOpen={() => open('speed')}
        />
        {props.quality ? (
          <NavRow
            id="quality"
            label={msg('player.menu.quality')}
            value={props.quality.buttonLabel}
            onOpen={() => open('quality')}
          />
        ) : null}
        {audio ? (
          <NavRow
            id="audio"
            label={msg('player.settings.audio')}
            value={audio.tracks.find((t) => t.id === audio.current)?.label ?? ''}
            onOpen={() => open('audio')}
          />
        ) : null}
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={props.autoplayNext}
          aria-disabled={locked || undefined}
          aria-label={autoplayName}
          className="adp-menu__row adp-menu__row--switch"
          onClick={() => {
            if (!locked) props.onAutoplay(!props.autoplayNext);
          }}
        >
          <span>{msg('player.settings.autoplay')}</span>
          <span className="adp-menu__value" aria-hidden="true">
            {props.autoplayNext ? msg('player.settings.on') : msg('player.settings.off')}
            <span className="adp-switch" data-on={props.autoplayNext || undefined}>
              <span className="adp-switch__knob" />
            </span>
          </span>
        </button>
        {props.onCaptionStyle ? (
          <button
            type="button"
            role="menuitem"
            className="adp-menu__row"
            onClick={props.onCaptionStyle}
          >
            {msg('player.captionStyle.link')}
          </button>
        ) : null}
        {props.onShortcuts ? (
          <button
            type="button"
            role="menuitem"
            className="adp-menu__row"
            onClick={props.onShortcuts}
          >
            {msg('player.settings.shortcuts')}
          </button>
        ) : null}
      </MenuShell>
    </div>
  );
}
