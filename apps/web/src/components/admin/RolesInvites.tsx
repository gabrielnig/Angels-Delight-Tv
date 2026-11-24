'use client';

import { useState } from 'react';
import { ADMIN_ACTIONS, can } from '@/lib/admin/can';
import { ACTION_LABELS } from '@/lib/admin/can-labels';
import { formatDate, formatDateTime } from '@/lib/admin/format';
import type { InviteRecord, StaffRecord } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { Button } from './Button';
import { ConfirmDialog, Dialog } from './Dialog';
import { SelectField, TextField } from './fields';
import { Icon } from './Icon';
import { useReauth } from './ReauthDialog';
import { Banner } from './states';
import { useCommand } from './useCommand';

export interface RoleActions {
  invite(email: string, role: string): Promise<CommandResult>;
  resend(id: string): Promise<CommandResult>;
  revoke(id: string): Promise<CommandResult>;
  changeRole(id: string, role: string): Promise<CommandResult>;
  /** Confirms the signed in person's password before invites and role changes (D-069). */
  reauthenticate(password: string): Promise<CommandResult>;
  /** Clears another person's authenticator. Needs the admin's own code. */
  resetTwoFactor(id: string, code: string): Promise<CommandResult>;
}

const ROLE_OPTIONS = [
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super admin' },
];
const ROLE_LABELS: Record<string, string> = {
  editor: 'Editor',
  admin: 'Admin',
  super_admin: 'Super admin',
};
const roleLabel = (role: string) => ROLE_LABELS[role] ?? 'Editor';
const ROLE_CONSEQUENCE: Record<string, string> = {
  super_admin:
    'Super admins can invite people, change roles, reset two step sign in, read the full audit log, change features and limits and retry failed jobs.',
  admin:
    'Admins can suspend accounts, change the theme and settings and read content actions in the audit log.',
  editor:
    'Editors lose access to users, roles, settings and the audit log. They keep video and home work.',
};

export function RolesInvites({
  staff,
  invites,
  now,
  canManage,
  selfId,
  actions,
}: {
  staff: StaffRecord[];
  invites: InviteRecord[];
  now: number;
  canManage: boolean;
  /** The signed in person. They cannot reset their own two factor here. */
  selfId?: string;
  actions: RoleActions;
}) {
  const { run, busy } = useCommand();
  const { guard, dialog: reauthDialog } = useReauth(actions.reauthenticate);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<{ member: StaffRecord; role: string } | null>(null);
  const [cancelInvite, setCancelInvite] = useState<InviteRecord | null>(null);
  const [roleError, setRoleError] = useState<string>();
  const [resetting, setResetting] = useState<StaffRecord | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [resetError, setResetError] = useState<string>();
  const supers = staff.filter((m) => m.role === 'super_admin').length;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => guard(() => actions.invite(email, role)), 'Invite sent.');
    if (result.ok) {
      setEmail('');
      setError(undefined);
    } else setError(result.error);
  }

  return (
    <div className="adm-stack">
      {roleError ? <Banner tone="danger">{roleError}</Banner> : null}
      <section className="adm-card adm-table-card" aria-labelledby="staff-h">
        <h2 className="adm-h3" id="staff-h">
          Admins
        </h2>
        {supers <= 1 ? (
          <p className="adm-muted" style={{ margin: 0, padding: '0 var(--space-4)' }}>
            Only one person is a Super admin, so that role is locked. Make someone else a Super
            admin first.
          </p>
        ) : null}
        <table className="adm-table adm-table--always adm-table--sticky">
          <caption className="adm-sr">People with admin access</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">2FA</th>
              <th scope="col">Last sign in</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((m) => {
              const lastSuper = m.role === 'super_admin' && supers <= 1;
              const own = m.id === selfId;
              return (
                <tr key={m.id}>
                  <th scope="row">{m.name}</th>
                  <td>{m.email}</td>
                  <td>
                    <SelectField
                      label={`Role for ${m.name}`}
                      value={m.role}
                      disabled={!canManage || busy || own || lastSuper}
                      options={ROLE_OPTIONS}
                      hint={
                        lastSuper
                          ? 'The only Super admin'
                          : own
                            ? 'You cannot change your own role'
                            : undefined
                      }
                      onChange={(e) => {
                        setRoleError(undefined);
                        if (e.target.value !== m.role)
                          setPending({ member: m, role: e.target.value });
                      }}
                    />
                  </td>
                  <td>
                    <Badge
                      tone={m.twoFactor ? 'success' : 'warning'}
                      icon={m.twoFactor ? 'shield' : 'alert'}
                    >
                      {m.twoFactor ? 'On' : 'Not set up'}
                    </Badge>
                    {canManage && m.twoFactor && m.id !== selfId ? (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        aria-label={`Reset two step sign in for ${m.name}`}
                        onClick={() => {
                          setResetCode('');
                          setResetError(undefined);
                          setResetting(m);
                        }}
                      >
                        Reset
                      </Button>
                    ) : null}
                  </td>
                  <td>{m.lastSignInAt ? formatDateTime(m.lastSignInAt) : 'Never'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="adm-card adm-stack" aria-labelledby="invite-h">
        <h2 className="adm-h3" id="invite-h">
          Invite a team member
        </h2>
        <form className="adm-row" style={{ alignItems: 'flex-end' }} onSubmit={invite} noValidate>
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            disabled={!canManage}
            error={error}
            onChange={(e) => setEmail(e.target.value)}
          />
          <SelectField
            label="Role"
            value={role}
            disabled={!canManage}
            options={ROLE_OPTIONS}
            onChange={(e) => setRole(e.target.value)}
          />
          <Button type="submit" variant="primary" icon="mail" loading={busy} disabled={!canManage}>
            Send invite
          </Button>
        </form>
        <p className="adm-muted" style={{ margin: 0 }}>
          The link works for 7 days and can be used once.
        </p>
      </section>

      <section className="adm-card adm-stack" aria-labelledby="pending-h">
        <h2 className="adm-h3" id="pending-h">
          Pending invites
        </h2>
        {invites.length === 0 ? (
          <p className="adm-muted" style={{ margin: 0 }}>
            No pending invites.
          </p>
        ) : (
          <ul className="adm-list">
            {invites.map((i) => {
              const expired = Date.parse(i.expiresAt) < now;
              return (
                <li key={i.id}>
                  <span className="adm-listrow__main">
                    <strong>{i.email}</strong>
                    <span className="adm-muted">
                      {roleLabel(i.role)}, invited by {i.invitedBy}
                    </span>
                    <Badge tone={expired ? 'danger' : 'neutral'} icon={expired ? 'alert' : 'clock'}>
                      {expired
                        ? `Expired ${formatDate(i.expiresAt)}`
                        : `Expires ${formatDate(i.expiresAt)}`}
                    </Badge>
                  </span>
                  <span className="adm-row">
                    <Button
                      disabled={!canManage || busy}
                      aria-label={`${expired ? 'Send a new invite' : 'Resend invite'} to ${i.email}`}
                      onClick={() =>
                        run(() => guard(() => actions.resend(i.id)), 'Invite sent again.')
                      }
                    >
                      {expired ? 'Send a new invite' : 'Resend'}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!canManage || busy}
                      aria-label={`Cancel invite to ${i.email}`}
                      onClick={() => setCancelInvite(i)}
                    >
                      Cancel
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="adm-card adm-table-card" aria-labelledby="matrix-h">
        <h2 className="adm-h3" id="matrix-h">
          What each role can do
        </h2>
        <table className="adm-table adm-table--always adm-table--sticky">
          <caption className="adm-sr">Permissions by role. This table is read only.</caption>
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col" className="adm-ctr">Editor</th>
              <th scope="col" className="adm-ctr">Admin</th>
              <th scope="col" className="adm-ctr">Super admin</th>
            </tr>
          </thead>
          <tbody>
            {ADMIN_ACTIONS.map((a) => (
              <tr key={a}>
                <th scope="row">{ACTION_LABELS[a]}</th>
                {(['editor', 'admin', 'super_admin'] as const).map((r) => (
                  <td key={r} className="adm-ctr">
                    {can(r, a) ? (
                      <>
                        <Icon name="check" size={16} /> <span>Yes</span>
                      </>
                    ) : (
                      <span className="adm-muted">No</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ConfirmDialog
        open={pending !== null}
        title={`Make ${pending?.member.name ?? 'this person'} ${pending?.role === 'super_admin' ? 'a' : 'an'} ${pending ? roleLabel(pending.role).toLowerCase() : 'editor'}?`}
        consequence={ROLE_CONSEQUENCE[pending?.role ?? 'editor'] ?? ''}
        confirmLabel="Change role"
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending) {
            const r = await run(
              () => guard(() => actions.changeRole(pending.member.id, pending.role)),
              'Role changed.',
            );
            if (!r.ok) setRoleError(r.error);
          }
          setPending(null);
        }}
      />
      <ConfirmDialog
        open={cancelInvite !== null}
        title="Cancel this invite?"
        consequence={`${cancelInvite?.email ?? 'The person'} will no longer be able to use the link.`}
        confirmLabel="Cancel invite"
        danger
        busy={busy}
        onClose={() => setCancelInvite(null)}
        onConfirm={async () => {
          if (cancelInvite) await run(() => actions.revoke(cancelInvite.id), 'Invite cancelled.');
          setCancelInvite(null);
        }}
      />
      <Dialog
        open={resetting !== null}
        onClose={() => setResetting(null)}
        title={`Reset two step sign in for ${resetting?.name ?? 'this person'}?`}
        description="They are signed out everywhere and must set up their authenticator again at their next sign in. Enter your own 6 digit code to confirm."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              type="submit"
              form="reset-2fa-form"
              loading={busy}
              disabled={!resetCode.trim()}
            >
              Reset
            </Button>
          </>
        }
      >
        <form
          id="reset-2fa-form"
          className="adm-stack"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!resetting) return;
            const r = await run(
              () => actions.resetTwoFactor(resetting.id, resetCode.replace(/\s/g, '')),
              'Two step sign in reset.',
            );
            if (r.ok) setResetting(null);
            else setResetError(r.error);
          }}
        >
          <TextField
            label="Your authenticator code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={resetCode}
            error={resetError}
            onChange={(e) => setResetCode(e.target.value)}
          />
        </form>
      </Dialog>
      {reauthDialog}
    </div>
  );
}
