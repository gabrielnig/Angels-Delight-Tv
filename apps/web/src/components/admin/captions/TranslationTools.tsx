'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CaptionResult } from '@/lib/data/admin/caption-commands';
import type { TranslationEstimateView } from '@/lib/data/admin/services';
import { Button } from '../Button';
import { AddTranslationDialog } from './AddTranslationDialog';
import { TranslationPublishSwitch } from './TranslationPublishSwitch';

export interface TranslationActions {
  estimate(language: string): Promise<TranslationEstimateView>;
  start(language: string): Promise<CaptionResult>;
  publish(language: string, published: boolean): Promise<CaptionResult>;
}

/** The Add translation button and, on a translation tab, its Publish switch (M46-S15). */
export function TranslationTools({
  spoken,
  current,
  available,
  canTranslate,
  canPublish,
  approved,
  published,
  actions,
}: {
  spoken: string;
  current: string;
  /** Languages turned on for captions that have no translation yet. */
  available: string[];
  canTranslate: boolean;
  canPublish: boolean;
  approved: boolean;
  published: boolean;
  actions: TranslationActions;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isTranslation = current !== spoken;
  return (
    <div className="adm-row">
      {isTranslation ? (
        <TranslationPublishSwitch
          language={current}
          approved={approved}
          published={published}
          canPublish={canPublish}
          onChange={async (next) => {
            const result = await actions.publish(current, next);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
      {canTranslate ? (
        <Button variant="secondary" icon="plus" onClick={() => setOpen(true)}>
          Add translation
        </Button>
      ) : null}
      {canTranslate ? (
        <AddTranslationDialog
          open={open}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
          languages={available}
          spoken={spoken}
          estimate={actions.estimate}
          start={actions.start}
        />
      ) : null}
    </div>
  );
}
