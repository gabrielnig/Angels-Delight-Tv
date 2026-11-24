'use client';

import { useState } from 'react';
import { formatDate, formatDateTime } from '@/lib/admin/format';
import type { UserRecord } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { TextArea, TextField } from './fields';
import { Banner } from './states';
import { useCommand } from './useCommand';

export interface UserActions {
  suspend(id: string, reason: string): Promise<CommandResult>;
  reinstate(id: string): Promise<CommandResult>;
  revokeSessions(id: string, reason: string): Promise<CommandResult>;
  /** Admin only. Clears the person's two step verification (M49-S04). */
  resetTwoFactor?(id: string, reason: string): Promise<CommandResult>;
  /** Super admin only. Starts the deletion the owner asked for. */
  deleteAccount?(id: string, confirmation: string): Promise<CommandResult>;
}

type Mode = 'suspend' | 'sessions' | 'reinstate' | 'delete' | 'twofactor' | null;

export function UserDetail({
  user,
  canAct,
  canDelete = false,
  actions,
}: {
  user: UserRecord;
  canAct: boolean;
  /** True only for a Super admin (M27-S03 AC3). */
  canDelete?: boolean;
  actions: UserActions;
}) {
  const { run, busy } = useCommand();
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string>();
  const close = () => {
    setMode(null);
    setReason('');
    setTyped('');
    setError(undefined);
  };

  async function confirm() {
    if (!mode) return;
    const result = await run(
      () =>
        mode === 'delete'
          ? actions.deleteAccount!(user.id, typed)
          : mode === 'suspend'
            ? actions.suspend(user.id, reason)
            : mode === 'sessions'
              ? actions.revokeSessions(user.id, reason)
              : mode === 'twofactor'
                ? actions.resetTwoFactor!(user.id, reason)
                : actions.reinstate(user.id),
      mode === 'delete'
        ? 'Deletion started.'
        : mode === 'suspend'
          ? 'Account suspended.'
          : mode === 'sessions'
            ? 'Signed out everywhere.'
            : mode === 'twofactor'
              ? 'Two step verification reset.'
              : 'Account reinstated.',
    );
    if (result.ok) close();
    else setError(result.error);
  }
  const needsReason = mode === 'suspend' || mode === 'sessions' || mode === 'twofactor';
  const titles = {
    suspend: 'Suspend this account?',
    sessions: 'Sign out of every device?',
    reinstate: 'Reinstate this account?',
    delete: 'Delete this account?',
    twofactor: 'Reset two step verification?',
  } as const;
  const help = {
    suspend:
      'The person is signed out and cannot sign in until you reinstate the account. Their profiles and lists are kept.',
    sessions: 'Every device is signed out. The person can sign in again with their password.',
    reinstate: 'The person can sign in again.',
    twofactor:
      'Use this only after you have checked it is really the owner, for example through the support email. Their authenticator and backup codes are removed, they are signed out everywhere and they get an email.',
    delete:
      'Use this only when the owner asked for it. The account is closed and their data is removed after the waiting period. They can cancel by signing in during that time.',
  } as const;

  return (
    <div className="adm-stack">
      {user.status === 'suspended' ? (
        <Banner tone="warning">
          <strong>This account is suspended.</strong> {user.suspendedReason}
        </Banner>
      ) : null}
      <section className="adm-card adm-stack" aria-labelledby="u-status">
        <h2 className="adm-h3" id="u-status">
          Account
        </h2>
        <dl className="adm-dl">
          <div>
            <dt>Status</dt>
            <dd>
              <Badge
                tone={user.status === 'active' ? 'success' : 'warning'}
                icon={user.status === 'active' ? 'check' : 'lock'}
              >
                {user.status === 'active' ? 'Active' : 'Suspended'}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt>Last active</dt>
            <dd>{user.lastActiveAt ? formatDateTime(user.lastActiveAt) : 'Never'}</dd>
          </div>
          <div>
            <dt>Signed in on</dt>
            <dd>
              {user.sessions} {user.sessions === 1 ? 'device' : 'devices'}
            </dd>
          </div>
        </dl>
      </section>
      <section className="adm-card adm-stack" aria-labelledby="u-profiles">
        <h2 className="adm-h3" id="u-profiles">
          Profiles
        </h2>
        <ul className="adm-list">
          {user.profiles.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              {p.kids ? <Badge tone="info">Kids</Badge> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="adm-card adm-stack" aria-labelledby="u-actions">
        <h2 className="adm-h3" id="u-actions">
          Support actions
        </h2>
        <p className="adm-muted" style={{ margin: 0 }}>
          Each action asks for a reason and is written to the audit log.
        </p>
        <div className="adm-row">
          <Button
            disabled={!canAct || user.sessions === 0}
            disabledReason={user.sessions === 0 ? 'No devices are signed in.' : undefined}
            onClick={() => setMode('sessions')}
          >
            Sign out everywhere
          </Button>
          {user.status === 'active' ? (
            <Button variant="danger" disabled={!canAct} onClick={() => setMode('suspend')}>
              Suspend account
            </Button>
          ) : (
            <Button variant="primary" disabled={!canAct} onClick={() => setMode('reinstate')}>
              Reinstate account
            </Button>
          )}
          {canAct && actions.resetTwoFactor ? (
            <Button variant="secondary" onClick={() => setMode('twofactor')}>
              Reset two step verification
            </Button>
          ) : null}
          {canDelete && actions.deleteAccount ? (
            <Button variant="danger" onClick={() => setMode('delete')}>
              Delete account
            </Button>
          ) : null}
        </div>
      </section>
      <Dialog
        open={mode !== null}
        onClose={close}
        title={mode ? titles[mode] : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant={mode === 'suspend' || mode === 'delete' ? 'danger' : 'primary'}
              loading={busy}
              disabled={mode === 'delete' && typed !== 'DELETE'}
              onClick={confirm}
            >
              {mode === 'delete'
                ? 'Delete account'
                : mode === 'suspend'
                  ? 'Suspend account'
                  : mode === 'sessions'
                    ? 'Sign out everywhere'
                    : mode === 'twofactor'
                      ? 'Reset two step verification'
                      : 'Reinstate account'}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>{mode ? help[mode] : ''}</p>
        {mode === 'delete' ? (
          <TextField
            label="Type DELETE to confirm"
            value={typed}
            autoComplete="off"
            error={error}
            onChange={(e) => setTyped(e.target.value)}
          />
        ) : needsReason ? (
          <TextArea
            label="Reason"
            hint="Kept in the audit log."
            value={reason}
            maxLength={200}
            error={error}
            onChange={(e) => setReason(e.target.value)}
          />
        ) : error ? (
          <Banner tone="danger">{error}</Banner>
        ) : null}
      </Dialog>
    </div>
  );
}
