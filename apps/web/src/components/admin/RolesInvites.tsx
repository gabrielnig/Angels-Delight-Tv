'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { ADMIN_ACTIONS, can } from '@/lib/admin/can';
import { ACTION_LABELS } from '@/lib/admin/can-labels';
import { formatDate, formatDateTime } from '@/lib/admin/format';
import { describeOutcome, mergeOutcomes, newBulkId, type BulkOutcome } from '@/lib/data/admin/bulk';
import type { StaffBulkAction } from '@/lib/data/admin/staff-bulk';
import type { InviteRecord, StaffRecord } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { Button } from './Button';
import { BulkBar } from './bulk/BulkBar';
import { BulkReport } from './bulk/BulkReport';
import { useBulkRun } from './bulk/useBulkRun';
import { useSelection } from './bulk/useSelection';
import { ConfirmDialog, Dialog } from './Dialog';
import { Checkbox, SelectField, TextField } from './fields';
import { Icon } from './Icon';
import { useReauth } from './ReauthDialog';
import { Banner } from './states';
import { useToast } from './Toast';
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
  /** Super admin only. Answers `reauth` when the password was not confirmed recently. */
  bulkPreflight?(): Promise<CommandResult>;
  bulk?(ids: string[], action: StaffBulkAction, bulkId: string): Promise<BulkOutcome>;
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
  canBulk = false,
  selfId,
  actions,
}: {
  staff: StaffRecord[];
  invites: InviteRecord[];
  now: number;
  canManage: boolean;
  /** Super admin only (roles.bulk). Shows the checkboxes and the bar. */
  canBulk?: boolean;
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
  const toast = useToast();
  const selectable = useMemo(
    () => [
      ...staff.filter((m) => m.role !== 'super_admin' && m.id !== selfId).map((m) => `staff:${m.id}`),
      ...invites.map((i) => `invite:${i.id}`),
    ],
    [staff, invites, selfId],
  );
  const sel = useSelection(selectable);
  const actionRef = useRef<StaffBulkAction>({ type: 'resend_invites' });
  const [roleConfirm, setRoleConfirm] = useState<'editor' | 'admin' | null>(null);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const [lastAction, setLastAction] = useState<StaffBulkAction>({ type: 'resend_invites' });
  const runner = useBulkRun(
    useCallback((chunk, bulkId) => actions.bulk!(chunk, actionRef.current, bulkId), [actions]),
    { chunkSize: 50 },
  );
  const chosen = [...sel.selected];
  const chosenStaff = chosen.filter((id) => id.startsWith('staff:')).map((id) => id.slice(6));
  const chosenInvites = chosen.filter((id) => id.startsWith('invite:')).map((id) => id.slice(7));
  const bulkLabel = (a: StaffBulkAction) =>
    a.type === 'role' ? `Make ${a.role === 'admin' ? 'Admin' : 'Editor'}` : 'Resend invites';
  const labelFor = (id: string) =>
    staff.find((m) => m.id === id)?.name ?? invites.find((i) => i.id === id)?.email ?? id;

  async function runBulk(action: StaffBulkAction, list: string[], prior?: BulkOutcome) {
    actionRef.current = action;
    setLastAction(action);
    setRoleConfirm(null);
    const result = await runner.start(list, prior?.bulkId ?? newBulkId());
    const merged = prior ? mergeOutcomes(prior, result) : result;
    if (merged.interrupted && merged.succeeded.length === 0 && merged.failed.length === 0) {
      toast.show({ tone: 'danger', message: `${bulkLabel(action)} did not work. Nothing was changed. Try again.` });
      return;
    }
    setOutcome(merged);
    sel.clear();
    if (merged.succeeded.length > 0)
      toast.show({ tone: 'success', message: describeOutcome(bulkLabel(action), merged) });
  }

  /** Asks for the password once up front, then starts (or asks to confirm) the batch. */
  async function startBulk(action: StaffBulkAction) {
    const ready = await guard(() => actions.bulkPreflight!());
    if (!ready.ok) {
      if (ready.error !== 'Nothing was changed.') setRoleError(ready.error);
      return;
    }
    if (action.type === 'role') setRoleConfirm(action.role);
    else void runBulk(action, chosenInvites);
  }

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
      {outcome ? (
        <BulkReport
          label={bulkLabel(lastAction)}
          outcome={outcome}
          itemLabel={labelFor}
          onDismiss={() => setOutcome(null)}
          onRetry={(list) => void runBulk(lastAction, list, outcome)}
        />
      ) : null}
      {canBulk && sel.count > 0 ? (
        <BulkBar
          count={sel.count}
          onClear={sel.clear}
          actions={[
            {
              id: 'editor',
              label: 'Make Editor',
              onClick: () => void startBulk({ type: 'role', role: 'editor' }),
              disabledReason: chosenInvites.length ? 'Select only people to change roles.' : undefined,
            },
            {
              id: 'admin',
              label: 'Make Admin',
              variant: 'primary',
              onClick: () => void startBulk({ type: 'role', role: 'admin' }),
              disabledReason: chosenInvites.length ? 'Select only people to change roles.' : undefined,
            },
            {
              id: 'resend',
              label: 'Resend invites',
              onClick: () => void startBulk({ type: 'resend_invites' }),
              disabledReason: chosenStaff.length ? 'Select only invites to resend.' : undefined,
            },
          ]}
        />
      ) : null}
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
              {canBulk ? (
                <th scope="col" className="adm-table__check">
                  <span className="adm-sr">Select</span>
                </th>
              ) : null}
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
                  {canBulk ? (
                    <td className="adm-table__check">
                      {own || m.role === 'super_admin' ? (
                        <span className="adm-select-spacer" aria-hidden="true" />
                      ) : (
                        <Checkbox
                          label={`Select ${m.name}`}
                          checked={sel.isSelected(`staff:${m.id}`)}
                          onChange={() => sel.toggle(`staff:${m.id}`)}
                        />
                      )}
                    </td>
                  ) : null}
                  <th scope="row">
                    {m.name}
                    {own ? <span className="adm-muted"> You</span> : null}
                  </th>
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
                  {canBulk ? (
                    <Checkbox
                      label={`Select ${i.email}`}
                      checked={sel.isSelected(`invite:${i.id}`)}
                      onChange={() => sel.toggle(`invite:${i.id}`)}
                    />
                  ) : null}
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
        open={roleConfirm !== null}
        title={`Make ${chosenStaff.length} ${chosenStaff.length === 1 ? 'person' : 'people'} ${roleConfirm === 'admin' ? 'an admin' : 'an editor'}?`}
        consequence={ROLE_CONSEQUENCE[roleConfirm ?? 'editor'] ?? ''}
        confirmLabel={`Make ${chosenStaff.length} ${roleConfirm === 'admin' ? 'Admin' : 'Editor'}`}
        busy={runner.running}
        onClose={() => setRoleConfirm(null)}
        onConfirm={() => roleConfirm && void runBulk({ type: 'role', role: roleConfirm }, chosenStaff)}
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
