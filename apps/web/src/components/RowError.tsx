'use client';

import { useState } from 'react';
import { Row } from '@ad/ui';
import type { CatalogItem, Progress, VideoSummary } from '../lib/data';
import { itemKey } from '../lib/format';
import { CatalogCard, ContinueRow } from './CatalogCard';

type ContinueItem = { video: VideoSummary; progress: Progress };

type Props =
  | {
      title: string;
      kind: 'list';
      viewAllHref?: string;
      viewAllLabel?: string;
      inList: string[];
      load: () => Promise<CatalogItem[]>;
    }
  | { title: string; kind: 'continue'; load: () => Promise<ContinueItem[]> };

/**
 * Inline row failure. The rest of the page keeps working and Try again reloads only this row, not the page
 * (M05-S02). A row that comes back empty disappears, as it would on first load.
 */
export function RowError(props: Props) {
  const [state, setState] = useState<'error' | 'loading' | 'done'>('error');
  const [list, setList] = useState<CatalogItem[]>([]);
  const [resume, setResume] = useState<ContinueItem[]>([]);

  async function retry() {
    setState('loading');
    try {
      if (props.kind === 'list') setList(await props.load());
      else setResume(await props.load());
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    if (props.kind === 'continue') {
      return resume.length > 0 ? <ContinueRow items={resume} /> : null;
    }
    if (list.length === 0) return null;
    const saved = new Set(props.inList);
    return (
      <Row title={props.title} viewAllHref={props.viewAllHref} viewAllLabel={props.viewAllLabel}>
        {list.map((item) => (
          <CatalogCard key={itemKey(item)} item={item} inList={saved.has(itemKey(item))} />
        ))}
      </Row>
    );
  }
  return (
    <Row
      title={props.title}
      state={state === 'loading' ? 'loading' : 'error'}
      onRetry={() => void retry()}
    />
  );
}
