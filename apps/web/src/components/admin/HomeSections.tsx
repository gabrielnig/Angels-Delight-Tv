'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  MAX_ROWS,
  MAX_ROW_NAME,
  ROW_TYPE_LABELS,
  moveRow,
  renameRow,
  reorderRows,
  toggleRow,
  viewAllSummary,
} from '@/lib/data/admin/home-rules';
import type { HomeConfig, SectionSources } from '@/lib/data/admin/home-rules';
import { Badge } from './Badge';
import { Button } from './Button';
import { Icon } from './Icon';
import { Switch } from './fields';

/**
 * The ordered list of Home sections (M41-S06, S07): drag a handle or use Move up and Move down,
 * rename in place, hide with a switch. Every change is announced in a live region.
 */
export function HomeSections({
  config,
  selectedId,
  sources,
  canCurate,
  onSelect,
  onChange,
  onAdd,
  onRestoreDefaults,
}: {
  config: HomeConfig;
  selectedId: string | null;
  sources: SectionSources;
  canCurate: boolean;
  onSelect: (id: string | null) => void;
  onChange: (config: HomeConfig) => void;
  onAdd: () => void;
  onRestoreDefaults: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const refocus = useRef<{ id: string; dir: 'up' | 'down' } | null>(null);

  // A moved row can be re-inserted by the browser, which drops focus. Put it back on the same button.
  useLayoutEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const row = list.current?.querySelector(`[data-section="${CSS.escape(target.id)}"]`);
    const pick = (dir: string) => row?.querySelector<HTMLButtonElement>(`[data-move="${dir}"]:not(:disabled)`);
    (pick(target.dir) ?? pick(target.dir === 'up' ? 'down' : 'up'))?.focus();
  }, [config.rows]);

  const announce = (next: HomeConfig, id: string) => {
    const name = next.rows.find((r) => r.id === id)?.name ?? '';
    setAnnouncement(`Moved ${name} to position ${next.rows.findIndex((r) => r.id === id) + 1}`);
  };
  const move = (id: string, delta: -1 | 1) => {
    const next = moveRow(config, id, delta);
    if (next === config) return;
    refocus.current = { id, dir: delta < 0 ? 'up' : 'down' };
    onChange(next);
    announce(next, id);
  };
  const dropOn = (targetId: string) => {
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (!from || from === targetId) return;
    const next = reorderRows(config, from, config.rows.findIndex((r) => r.id === targetId));
    onChange(next);
    announce(next, from);
  };
  const startRename = (id: string, name: string) => {
    setRenaming(id);
    setDraft(name);
    setNameError(undefined);
  };
  const saveRename = (id: string) => {
    const result = renameRow(config, id, draft);
    if (!result.ok) return setNameError(result.error);
    onChange(result.config);
    setRenaming(null);
    setNameError(undefined);
  };

  return (
    <section className="adm-card adm-stack" aria-labelledby="home-sections">
      <div className="adm-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="adm-h3" id="home-sections">
          Sections
        </h2>
        <span className="adm-muted">
          {config.rows.length} of {MAX_ROWS}
        </span>
        <Button icon="plus" variant="primary" disabled={!canCurate} onClick={onAdd}>
          Add section
        </Button>
      </div>
      <p className="adm-sr" role="status" aria-label="Section changes">
        {announcement}
      </p>
      <p className="adm-sr" id="home-sections-hint">
        Drag the handle, or use Move up and Move down.
      </p>
      {config.rows.length === 0 ? (
        <div className="adm-stack">
          <p className="adm-muted" style={{ margin: 0 }}>
            No sections yet. Home shows only the hero until you add a section. Start from the launch
            defaults or add your own.
          </p>
          <div className="adm-row">
            <Button disabled={!canCurate} onClick={onRestoreDefaults}>
              Restore launch defaults
            </Button>
          </div>
        </div>
      ) : null}
      <ol ref={list} className="adm-sections" aria-label="Sections in the order viewers see them">
        {config.rows.map((r, i) => (
          <li
            key={r.id}
            data-section={r.id}
            className={[
              'adm-section',
              selectedId === r.id ? 'is-selected' : '',
              dragId === r.id ? 'is-dragging' : '',
              overId === r.id && dragId !== r.id ? 'is-over' : '',
            ].join(' ')}
            draggable={canCurate && renaming !== r.id}
            onDragStart={(e) => {
              setDragId(r.id);
              e.dataTransfer?.setData?.('text/plain', r.id);
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(r.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(r.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
          >
            <button
              type="button"
              className="adm-section__grip"
              aria-label={`Drag to reorder ${r.name}`}
              aria-describedby="home-sections-hint"
              disabled={!canCurate}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  move(r.id, e.key === 'ArrowUp' ? -1 : 1);
                }
              }}
            >
              <Icon name="drag" size={20} />
            </button>
            {renaming === r.id ? (
              <div className="adm-section__body">
                <label className="adm-sr" htmlFor={`rename-${r.id}`}>
                  Section name
                </label>
                <input
                  id={`rename-${r.id}`}
                  className="adm-input"
                  autoFocus
                  value={draft}
                  maxLength={MAX_ROW_NAME + 20}
                  aria-invalid={nameError ? true : undefined}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setNameError(undefined);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename(r.id);
                    if (e.key === 'Escape') {
                      setRenaming(null);
                      setNameError(undefined);
                    }
                  }}
                />
                <span className="adm-muted">
                  {draft.trim().length} of {MAX_ROW_NAME}
                </span>
                {nameError ? (
                  <span className="adm-field__error" role="alert">
                    {nameError}
                  </span>
                ) : (
                  <span className="adm-muted">Press Enter to save, Escape to cancel</span>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="adm-section__body adm-section__edit"
                aria-label={`Edit ${r.name}`}
                aria-pressed={selectedId === r.id}
                onClick={() => onSelect(selectedId === r.id ? null : r.id)}
              >
                <strong>{r.name}</strong>
                <span className="adm-muted">
                  {ROW_TYPE_LABELS[r.type]} · {viewAllSummary(r, sources)}
                </span>
              </button>
            )}
            {renaming === r.id ? null : (
              <Button
                variant="ghost"
                aria-label={`Rename ${r.name}`}
                disabled={!canCurate}
                onClick={() => startRename(r.id, r.name)}
              >
                Rename
              </Button>
            )}
            <Badge tone={r.kidsVisible === false ? 'neutral' : 'info'}>
              {r.kidsVisible === false ? 'Adults' : 'Kids'}
            </Badge>
            <Switch
              label={`Show ${r.name}`}
              checked={r.visible}
              disabled={!canCurate}
              onLabel="Visible"
              offLabel="Hidden"
              onChange={() => onChange(toggleRow(config, r.id))}
            />
            <Button
              variant="ghost"
              icon="up"
              data-move="up"
              aria-label={`Move ${r.name} up`}
              disabled={!canCurate || i === 0}
              onClick={() => move(r.id, -1)}
            />
            <Button
              variant="ghost"
              icon="down"
              data-move="down"
              aria-label={`Move ${r.name} down`}
              disabled={!canCurate || i === config.rows.length - 1}
              onClick={() => move(r.id, 1)}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
