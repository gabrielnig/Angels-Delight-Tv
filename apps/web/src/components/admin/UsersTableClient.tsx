'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { formatDate } from '@/lib/admin/format';
import {
  describeOutcome,
  mergeOutcomes,
  newBulkId,
  type BulkOutcome,
  type BulkUndo,
} from '@/lib/data/admin/bulk';
import type { UserRecord } from '@/lib/data/admin/types';
import type { UserBulkAction } from '@/lib/data/admin/user-bulk';
import { Badge } from './Badge';
import { BulkBar } from './bulk/BulkBar';
import { BulkReport } from './bulk/BulkReport';
import { useBulkRun } from './bulk/useBulkRun';
import { useSelection } from './bulk/useSelection';
import { ConfirmDialog } from './Dialog';
import { Checkbox, TextField } from './fields';
import { useToast } from './Toast';

const labelOf = (a: UserBulkAction) =>
  a.type === 'suspend' ? 'Suspend' : a.type === 'reinstate' ? 'Reinstate' : 'Force sign out';

/**
 * The viewer accounts table with selection (M42-S14). Selection is page scope only. The acting account is
 * greyed and cannot be selected. The search and status filter stay a plain GET form in the server wrapper.
 */
export function UsersTableClient({
  users,
  canBulk,
  selfId,
  bulk,
  undo,
}: {
  users: UserRecord[];
  canBulk: boolean;
  selfId: string;
  bulk: (ids: string[], action: UserBulkAction, bulkId: string) => Promise<BulkOutcome>;
  undo: (undo: BulkUndo) => Promise<{ succeeded: string[]; failed: unknown[] }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const tableRef = useRef<HTMLDivElement>(null);
  const ids = useMemo(() => users.map((u) => u.id), [users]);
  const isLocked = useCallback((id: string) => id === selfId, [selfId]);
  const sel = useSelection(ids, { isLocked });
  const actionRef = useRef<UserBulkAction>({ type: 'reinstate' });
  const [dialog, setDialog] = useState<'suspend' | 'sign_out' | null>(null);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const [lastAction, setLastAction] = useState<UserBulkAction>({ type: 'reinstate' });
  const runner = useBulkRun(
    useCallback((chunk, bulkId) => bulk(chunk, actionRef.current, bulkId), [bulk]),
    { chunkSize: 25 },
  );
  const emailOf = (id: string) => users.find((u) => u.id === id)?.email ?? id;

  async function doUndo(payload: BulkUndo) {
    try {
      const r = await undo(payload);
      toast.show({
        tone: r.failed.length ? 'danger' : 'success',
        message: r.failed.length
          ? `Undo put back ${r.succeeded.length}. ${r.failed.length} could not be put back.`
          : `Undone: ${r.succeeded.length} put back.`,
      });
      router.refresh();
    } catch {
      toast.show({ tone: 'danger', message: 'Undo did not work. Nothing was changed.' });
    }
  }

  async function run(action: UserBulkAction, list: string[], prior?: BulkOutcome) {
    actionRef.current = action;
    setLastAction(action);
    setDialog(null);
    setReason('');
    const result = await runner.start(list, prior?.bulkId ?? newBulkId());
    const merged = prior ? mergeOutcomes(prior, result) : result;
    if (merged.interrupted && merged.succeeded.length === 0 && merged.failed.length === 0) {
      toast.show({
        tone: 'danger',
        message: `${labelOf(action)} did not work. Nothing was changed. Try again.`,
      });
      return;
    }
    setOutcome(merged);
    sel.clear();
    if (merged.succeeded.length > 0) {
      const payload = merged.undo;
      toast.show({
        tone: 'success',
        message: describeOutcome(labelOf(action), merged),
        ...(payload
          ? { actionLabel: 'Undo', durationMs: 10000, onAction: () => void doUndo(payload) }
          : {}),
      });
    }
    router.refresh();
  }

  const ok = reason.trim().length >= 3;
  const count = sel.count;
  const noun = `${count} ${count === 1 ? 'account' : 'accounts'}`;

  return (
    <>
      {outcome ? (
        <BulkReport
          label={labelOf(lastAction)}
          outcome={outcome}
          itemLabel={emailOf}
          itemHref={(id) => `/admin/users/${id}`}
          onDismiss={() => setOutcome(null)}
          onRetry={(list) => void run(lastAction, list, outcome)}
        />
      ) : null}
      {canBulk && count > 0 ? (
        <BulkBar
          count={count}
          onClear={sel.clear}
          returnFocusTo={() => tableRef.current}
          actions={[
            {
              id: 'suspend',
              label: 'Suspend',
              variant: 'danger',
              onClick: () => setDialog('suspend'),
            },
            {
              id: 'reinstate',
              label: 'Reinstate',
              onClick: () => void run({ type: 'reinstate' }, [...sel.selected]),
            },
            {
              id: 'sign_out',
              label: 'Force sign out',
              secondary: true,
              onClick: () => setDialog('sign_out'),
            },
          ]}
        />
      ) : null}
      <div className="adm-card adm-table-card" ref={tableRef} tabIndex={-1}>
        <table className="adm-table">
          <caption className="adm-sr">Viewer accounts</caption>
          <thead>
            <tr>
              {canBulk ? (
                <th scope="col" className="adm-table__check">
                  <Checkbox
                    label="Select all on this page"
                    checked={sel.allOnPage}
                    mixed={sel.someOnPage && !sel.allOnPage}
                    onChange={sel.togglePage}
                  />
                </th>
              ) : null}
              <th scope="col">Email</th>
              <th scope="col">Status</th>
              <th scope="col">Created</th>
              <th scope="col">Last active</th>
              <th scope="col" className="adm-num">
                Profiles
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={sel.isSelected(u.id) ? 'is-selected' : undefined}>
                {canBulk ? (
                  <td className="adm-table__check">
                    {u.id === selfId ? (
                      <span className="adm-select-spacer" aria-hidden="true" />
                    ) : (
                      <Checkbox
                        label={`Select ${u.email}`}
                        checked={sel.isSelected(u.id)}
                        onChange={() => sel.toggle(u.id)}
                      />
                    )}
                  </td>
                ) : null}
                <th scope="row">
                  <Link className="adm-link" href={`/admin/users/${u.id}`}>
                    {u.email}
                  </Link>
                  {u.id === selfId ? <span className="adm-muted"> You</span> : null}
                </th>
                <td>
                  <Badge
                    tone={u.status === 'active' ? 'success' : 'warning'}
                    icon={u.status === 'active' ? 'check' : 'lock'}
                  >
                    {u.status === 'active' ? 'Active' : 'Suspended'}
                  </Badge>
                </td>
                <td>{formatDate(u.createdAt)}</td>
                <td>{u.lastActiveAt ? formatDate(u.lastActiveAt) : 'Never'}</td>
                <td className="adm-num">{u.profiles.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="adm-cards" aria-label="Viewer accounts">
          {users.map((u) => (
            <li
              key={u.id}
              className={`adm-vcard adm-vcard--plain${sel.isSelected(u.id) ? ' is-selected' : ''}`}
            >
              {canBulk && u.id !== selfId ? (
                <Checkbox
                  label={`Select ${u.email}`}
                  checked={sel.isSelected(u.id)}
                  onChange={() => sel.toggle(u.id)}
                />
              ) : (
                <span className="adm-select-spacer" aria-hidden="true" />
              )}
              <div className="adm-vcard__body">
                <Link className="adm-link" href={`/admin/users/${u.id}`}>
                  {u.email}
                </Link>
                {u.id === selfId ? <span className="adm-muted">You</span> : null}
                <div className="adm-row">
                  <Badge
                    tone={u.status === 'active' ? 'success' : 'warning'}
                    icon={u.status === 'active' ? 'check' : 'lock'}
                  >
                    {u.status === 'active' ? 'Active' : 'Suspended'}
                  </Badge>
                  <span className="adm-muted">{u.profiles.length} profiles</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog
        open={dialog === 'suspend'}
        title={`Suspend ${noun}?`}
        consequence="They are signed out and cannot sign in until you reinstate them. The reason is kept in the audit log."
        confirmLabel={`Suspend ${count}`}
        danger
        busy={runner.running}
        confirmDisabled={!ok}
        onClose={() => setDialog(null)}
        onConfirm={() => void run({ type: 'suspend', reason: reason.trim() }, [...sel.selected])}
      >
        <TextField
          label="Reason"
          value={reason}
          hint="At least 3 characters."
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'sign_out'}
        title={`Sign ${noun} out everywhere?`}
        consequence="Every session ends. They can sign in again. The reason is kept in the audit log."
        confirmLabel={`Sign out ${count}`}
        busy={runner.running}
        confirmDisabled={!ok}
        onClose={() => setDialog(null)}
        onConfirm={() => void run({ type: 'sign_out', reason: reason.trim() }, [...sel.selected])}
      >
        <TextField
          label="Reason"
          value={reason}
          hint="At least 3 characters."
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
    </>
  );
}
