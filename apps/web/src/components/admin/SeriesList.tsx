'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SeriesRow } from '@/lib/data/admin/services';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { TextArea, TextField } from './fields';
import { EmptyState } from './states';
import { useCommand } from './useCommand';

export function SeriesList({
  series,
  canManage,
  create,
}: {
  series: SeriesRow[];
  canManage: boolean;
  create: (title: string, description: string) => Promise<CommandResult>;
}) {
  const { run, busy } = useCommand();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();

  async function save() {
    const result = await run(() => create(title, description), 'Series created as a draft.');
    if (result.ok) {
      setOpen(false);
      setTitle('');
      setDescription('');
    } else setError(result.error);
  }
  return (
    <div className="adm-stack">
      <div className="adm-row">
        <Button
          variant="primary"
          icon="plus"
          disabled={!canManage}
          onClick={() => {
            setError(undefined);
            setOpen(true);
          }}
        >
          New series
        </Button>
      </div>
      {series.length === 0 ? (
        <EmptyState
          title="No series yet."
          help="A series groups episodes into seasons. Create one, then add videos to it."
          icon="series"
        />
      ) : (
        <ul className="adm-cardlist" aria-label="Series">
          {series.map((s) => (
            <li key={s.id} className="adm-card adm-listrow">
              <div className="adm-listrow__main">
                <Link href={`/admin/series/${s.id}`} className="adm-link">
                  <strong>{s.title}</strong>
                </Link>
                <span className="adm-muted">
                  {s.episodeCount} {s.episodeCount === 1 ? 'episode' : 'episodes'}
                </span>
                <Badge
                  tone={s.published ? 'success' : 'neutral'}
                  icon={s.published ? 'check' : 'clock'}
                >
                  {s.published ? 'Published' : 'Draft'}
                </Badge>
              </div>
              <p className="adm-muted" style={{ margin: 0 }}>
                {s.description || 'No description yet.'}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New series"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={save}>
              Create series
            </Button>
          </>
        }
      >
        <TextField
          label="Title"
          value={title}
          maxLength={80}
          error={error}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          label="Description"
          hint="One or two sentences viewers will read."
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Dialog>
    </div>
  );
}
