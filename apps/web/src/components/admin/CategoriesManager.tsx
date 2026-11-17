'use client';

import { useState } from 'react';
import type { CategoryRow } from '@/lib/data/admin/services';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { Button } from './Button';
import { ConfirmDialog, Dialog } from './Dialog';
import { TextField } from './fields';
import { EmptyState } from './states';
import { useCommand } from './useCommand';

export interface CategoryActions {
  create(name: string): Promise<CommandResult>;
  rename(id: string, name: string): Promise<CommandResult>;
  hide(id: string, hidden: boolean): Promise<CommandResult>;
  move(id: string, delta: -1 | 1): Promise<CommandResult>;
  remove(id: string): Promise<CommandResult>;
}

export function CategoriesManager({
  categories,
  canManage,
  actions,
}: {
  categories: CategoryRow[];
  canManage: boolean;
  actions: CategoryActions;
}) {
  const { run, busy } = useCommand();
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [removing, setRemoving] = useState<CategoryRow | null>(null);

  const open = (target: CategoryRow | 'new') => {
    setEditing(target);
    setName(target === 'new' ? '' : target.name);
    setError(undefined);
  };
  async function save() {
    if (!editing) return;
    const result = await run(
      () => (editing === 'new' ? actions.create(name) : actions.rename(editing.id, name)),
      editing === 'new' ? 'Category added.' : 'Category renamed.',
    );
    if (result.ok) setEditing(null);
    else setError(result.error);
  }

  return (
    <div className="adm-stack">
      <div className="adm-row">
        <Button variant="primary" icon="plus" disabled={!canManage} onClick={() => open('new')}>
          Add category
        </Button>
      </div>
      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet."
          help="Categories help viewers browse. Add the first one."
          icon="categories"
        />
      ) : (
        <ol className="adm-cardlist" aria-label="Categories in the order viewers see them">
          {categories.map((c, i) => (
            <li key={c.id} className="adm-card adm-listrow">
              <div className="adm-listrow__main">
                <strong>{c.name}</strong>
                <span className="adm-muted">
                  {c.videoCount} {c.videoCount === 1 ? 'video' : 'videos'}
                </span>
                {c.hidden ? (
                  <Badge tone="neutral" icon="eyeoff">
                    Hidden
                  </Badge>
                ) : null}
              </div>
              <div className="adm-row">
                <Button
                  variant="ghost"
                  icon="up"
                  aria-label={`Move ${c.name} up`}
                  disabled={!canManage || busy || i === 0}
                  onClick={() => run(() => actions.move(c.id, -1), `${c.name} moved up.`)}
                />
                <Button
                  variant="ghost"
                  icon="down"
                  aria-label={`Move ${c.name} down`}
                  disabled={!canManage || busy || i === categories.length - 1}
                  onClick={() => run(() => actions.move(c.id, 1), `${c.name} moved down.`)}
                />
                <Button
                  variant="ghost"
                  aria-label={`Rename ${c.name}`}
                  disabled={!canManage}
                  onClick={() => open(c)}
                >
                  Rename
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`${c.hidden ? 'Show' : 'Hide'} ${c.name}`}
                  disabled={!canManage || busy}
                  onClick={() =>
                    run(
                      () => actions.hide(c.id, !c.hidden),
                      c.hidden
                        ? `${c.name} is visible again.`
                        : `${c.name} is hidden from viewers.`,
                    )
                  }
                >
                  {c.hidden ? 'Show' : 'Hide'}
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Delete ${c.name}`}
                  disabled={!canManage}
                  onClick={() => setRemoving(c)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a category' : 'Rename category'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <TextField
          label="Name"
          value={name}
          maxLength={40}
          error={error}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
        />
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        title={`Delete ${removing?.name ?? 'category'}?`}
        consequence={
          removing && removing.videoCount > 0
            ? `${removing.videoCount} videos still use it, so it cannot be deleted. Hide it instead.`
            : 'Viewers will no longer see this category. This cannot be undone.'
        }
        confirmLabel="Delete category"
        danger
        busy={busy}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await run(() => actions.remove(removing.id), 'Category deleted.');
          setRemoving(null);
        }}
      />
    </div>
  );
}
