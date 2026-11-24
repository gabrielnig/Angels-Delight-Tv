'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MAX_SELECTION, capSelection } from '@/lib/data/admin/bulk';

export interface SelectionOptions {
  /** Rows that can never be selected (own account, a running job). */
  isLocked?: (id: string) => boolean;
}

/**
 * Selection by id. It survives `router.refresh()` polling because it is keyed by id, and it prunes ids that
 * leave the data so nothing stays selected out of sight. Scope is the current page, or a snapshot of ids
 * that match a filter ("select all N that match", capped at MAX_SELECTION).
 */
export function useSelection(rowIds: readonly string[], options: SelectionOptions = {}) {
  const { isLocked } = options;
  const [raw, setRaw] = useState<ReadonlySet<string>>(new Set());
  const [scope, setScope] = useState<'page' | 'matching'>('page');
  const [capped, setCapped] = useState<{ total: number; used: number } | null>(null);

  const selectable = useMemo(
    () => rowIds.filter((id) => !(isLocked?.(id) ?? false)),
    [rowIds, isLocked],
  );

  const selected = useMemo<ReadonlySet<string>>(() => {
    if (scope === 'matching') return raw;
    const onPage = new Set(selectable);
    return new Set([...raw].filter((id) => onPage.has(id)));
  }, [raw, scope, selectable]);

  // Commit the prune so the stored set does not grow stale.
  useEffect(() => {
    if (scope === 'page' && selected.size !== raw.size) setRaw(selected);
  }, [scope, selected, raw]);

  const leaveMatching = useCallback(() => {
    setScope('page');
    setCapped(null);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      if (isLocked?.(id)) return;
      const base = scope === 'matching' ? new Set<string>() : new Set(selected);
      if (scope === 'matching') leaveMatching();
      if (base.has(id)) base.delete(id);
      else base.add(id);
      setRaw(base);
    },
    [isLocked, scope, selected, leaveMatching],
  );

  const allOnPage = selectable.length > 0 && selectable.every((id) => selected.has(id));
  const someOnPage = selectable.some((id) => selected.has(id));

  const togglePage = useCallback(() => {
    leaveMatching();
    setRaw(allOnPage ? new Set() : new Set(selectable));
  }, [allOnPage, selectable, leaveMatching]);

  const clear = useCallback(() => {
    leaveMatching();
    setRaw(new Set());
  }, [leaveMatching]);

  const selectMatching = useCallback((ids: readonly string[]) => {
    const cut = capSelection(ids);
    setRaw(new Set(cut.ids));
    setScope('matching');
    setCapped(cut.capped ? { total: cut.total, used: MAX_SELECTION } : null);
  }, []);

  return {
    selected,
    count: selected.size,
    scope,
    capped,
    isSelected: (id: string) => selected.has(id),
    toggle,
    togglePage,
    clear,
    selectMatching,
    allOnPage,
    someOnPage,
  };
}
