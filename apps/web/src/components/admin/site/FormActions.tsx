'use client';

import type { ReactNode } from 'react';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Banner } from '../states';

export function FormActions({
  dirty,
  busy,
  onSave,
  onDiscard,
  failure,
  blocked,
  children,
}: {
  dirty: boolean;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
  failure: string | null;
  /** Why Save is off even though something changed. */
  blocked?: string;
  children?: ReactNode;
}) {
  return (
    <>
      {failure ? (
        <Banner tone="danger">
          <strong>Your changes are still here.</strong> {failure}
        </Banner>
      ) : null}
      <div className="adm-form-actions">
        {dirty ? (
          <Badge tone="warning" icon="alert">
            Unsaved changes
          </Badge>
        ) : null}
        {children}
        <Button variant="ghost" disabled={!dirty || busy} onClick={onDiscard}>
          Discard
        </Button>
        <Button
          variant="primary"
          loading={busy}
          disabledReason={blocked ?? (dirty ? undefined : 'No changes to save.')}
          onClick={onSave}
        >
          Save changes
        </Button>
      </div>
    </>
  );
}
