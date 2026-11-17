'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface TabItem {
  id: string;
  label: string;
  panel: ReactNode;
  disabled?: boolean;
}

export function Tabs({
  label,
  tabs,
  value,
  defaultValue,
  onChange,
  className,
}: {
  label: string;
  tabs: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
}) {
  const base = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs.find((tab) => !tab.disabled)?.id ?? '');
  const selected = value ?? inner;
  const refs = useRef(new Map<string, HTMLButtonElement>());

  function select(id: string) {
    if (value === undefined) setInner(id);
    onChange?.(id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = tabs.filter((tab) => !tab.disabled);
    const index = enabled.findIndex((tab) => tab.id === selected);
    let target: TabItem | undefined;
    if (event.key === 'ArrowRight') target = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft')
      target = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') target = enabled[0];
    else if (event.key === 'End') target = enabled[enabled.length - 1];
    if (!target) return;
    event.preventDefault();
    select(target.id);
    refs.current.get(target.id)?.focus();
  }

  const active = tabs.find((tab) => tab.id === selected);

  return (
    <div className={cx('ad-tabs', className)}>
      <div role="tablist" aria-label={label} className="ad-tabs__list" onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) refs.current.set(tab.id, node);
              else refs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.id}`}
            aria-selected={tab.id === selected}
            aria-controls={`${base}-panel`}
            tabIndex={tab.id === selected ? 0 : -1}
            disabled={tab.disabled}
            className="ad-tabs__tab"
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${selected}`}
        className="ad-tabs__panel"
        tabIndex={0}
      >
        {active?.panel}
      </div>
    </div>
  );
}
