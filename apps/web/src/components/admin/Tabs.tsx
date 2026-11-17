'use client';

import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface TabDef {
  id: string;
  label: string;
  disabled?: boolean;
  count?: number;
}

/** Pill tabs, DESIGN-SYSTEM 11.15. Roving tabindex, arrows move, Home and End jump. */
export function Tabs({
  tabs,
  value,
  onChange,
  label,
  children,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  /** Panel for the active tab. */
  children: ReactNode;
}) {
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = tabs.filter((tab) => !tab.disabled);

  function onKeyDown(event: KeyboardEvent) {
    const index = enabled.findIndex((tab) => tab.id === value);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % enabled.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    else return;
    event.preventDefault();
    const target = enabled[next];
    if (target) {
      onChange(target.id);
      refs.current[target.id]?.focus();
    }
  }

  return (
    <div className="adm-tabs">
      <div className="adm-tabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.id}`}
            aria-selected={tab.id === value}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={tab.id === value ? 0 : -1}
            disabled={tab.disabled}
            className="adm-tab"
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="adm-tab__count">{tab.count}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel-${value}`} aria-labelledby={`${base}-tab-${value}`} tabIndex={0} className="adm-tabs__panel">
        {children}
      </div>
    </div>
  );
}
