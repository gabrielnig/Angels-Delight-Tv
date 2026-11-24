'use client';

import { useState } from 'react';
import { addTitle, moveTitle, removeTitle } from '@/lib/data/admin/home-rules';
import type { HomeConfig, HomeRow } from '@/lib/data/admin/home-rules';
import type { VideoRecord } from '@/lib/data/admin/types';
import { Badge } from './Badge';
import { Button } from './Button';
import { SelectField } from './fields';

export interface TitleSources {
  byId: Map<string, VideoRecord>;
  eligible: VideoRecord[];
}

/** The titles of a manual section: order, remove and add (M17-S02). */
export function ManualTitles({
  config,
  row,
  titles,
  canCurate,
  onChange,
  onError,
}: {
  config: HomeConfig;
  row: HomeRow;
  titles: TitleSources;
  canCurate: boolean;
  onChange: (config: HomeConfig) => void;
  onError: (message: string) => void;
}) {
  const [pick, setPick] = useState('');
  return (
    <>
      <ol className="adm-list">
        {row.videoIds.map((id, i) => {
          const v = titles.byId.get(id);
          const name = v?.title ?? 'title';
          return (
            <li key={id}>
              <span>
                {v?.title ?? 'Removed video'}
                {v && v.publishState !== 'published' ? (
                  <>
                    {' '}
                    <Badge tone="warning" icon="alert">
                      Not published, skipped
                    </Badge>
                  </>
                ) : null}
              </span>
              <span className="adm-row">
                <Button
                  variant="ghost"
                  icon="up"
                  aria-label={`Move ${name} up`}
                  disabled={!canCurate || i === 0}
                  onClick={() => onChange(moveTitle(config, row.id, id, -1))}
                />
                <Button
                  variant="ghost"
                  icon="down"
                  aria-label={`Move ${name} down`}
                  disabled={!canCurate || i === row.videoIds.length - 1}
                  onClick={() => onChange(moveTitle(config, row.id, id, 1))}
                />
                <Button
                  variant="ghost"
                  aria-label={`Remove ${name} from section`}
                  disabled={!canCurate}
                  onClick={() => onChange(removeTitle(config, row.id, id))}
                >
                  Remove
                </Button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="adm-row">
        <SelectField
          label="Add title"
          value={pick}
          disabled={!canCurate}
          onChange={(e) => setPick(e.target.value)}
          options={[
            { value: '', label: 'Choose a title' },
            ...titles.eligible
              .filter((v) => !row.videoIds.includes(v.id))
              .map((v) => ({ value: v.id, label: v.title })),
          ]}
        />
        <Button
          disabled={!pick || !canCurate}
          onClick={() => {
            const result = addTitle(config, row.id, pick);
            if (result.ok) {
              onChange(result.config);
              setPick('');
            } else onError(result.error);
          }}
        >
          Add to section
        </Button>
      </div>
    </>
  );
}
