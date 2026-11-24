'use client';

import { useState } from 'react';
import type { InviteCodeDto, InviteCodeInput, InviteCodeResult } from '@/lib/data/admin/site-types';
import { formatDate } from '@/lib/admin/format';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { ConfirmDialog } from '../Dialog';
import { TextField } from '../fields';
import { Card } from '../PageHeader';
import { Banner } from '../states';
import { useToast } from '../Toast';

export interface InviteCodeActions {
  create(input: InviteCodeInput): Promise<InviteCodeResult>;
  revoke(id: string): Promise<InviteCodeResult>;
}

const STATUS: Record<InviteCodeDto['status'], { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  active: { label: 'Active', tone: 'success' },
  used_up: { label: 'Used up', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'warning' },
  revoked: { label: 'Revoked', tone: 'danger' },
};

/** A date picked in the form means the end of that day in Lagos (UTC+1, no daylight saving). */
const endOfLagosDay = (day: string) => `${day}T22:59:59.000Z`;

/** Invite codes for viewer sign up during a soft launch (M29-S03). */
export function InviteCodesTab({
  initial,
  signUpOpen,
  actions,
}: {
  initial: InviteCodeDto[];
  signUpOpen: boolean;
  actions: InviteCodeActions;
}) {
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [label, setLabel] = useState('');
  const [uses, setUses] = useState('10');
  const [day, setDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [fresh, setFresh] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<InviteCodeDto | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const result = await actions.create({
        label: label.trim(),
        maxUses: Number(uses),
        expiresAt: day ? endOfLagosDay(day) : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows(result.invites);
      setFresh(result.code ?? null);
      setLabel('');
      setDay('');
    } catch {
      setError('That did not work. Nothing was changed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.show({ tone: 'success', message: 'Code copied.' });
    } catch {
      toast.show({ tone: 'danger', message: 'Could not copy. Select the code and copy it.' });
    }
  }

  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    try {
      const result = await actions.revoke(revoking.id);
      if (result.ok) {
        setRows(result.invites);
        toast.show({ tone: 'success', message: 'Code revoked.' });
      } else toast.show({ tone: 'danger', message: result.error });
    } catch {
      toast.show({ tone: 'danger', message: 'That did not work. Nothing was changed. Try again.' });
    } finally {
      setBusy(false);
      setRevoking(null);
    }
  }

  return (
    <div className="adm-stack">
      <Card title="Invite codes">
        <div className="adm-stack">
          {signUpOpen ? (
            <Banner tone="info">
              Sign up is open, so visitors do not need a code. Turn off Sign up open in Features and
              limits to require one.
            </Banner>
          ) : null}
          {fresh ? (
            <Banner tone="success">
              <span>
                New code: <strong className="ads-code">{fresh}</strong>. Copy it now. It will not be
                shown again.
              </span>{' '}
              <Button variant="ghost" icon="copy" onClick={() => void copy(fresh)}>
                Copy code
              </Button>
            </Banner>
          ) : null}
          <form className="adm-row" style={{ alignItems: 'flex-end' }} onSubmit={create} noValidate>
            <TextField
              label="Label"
              hint="For you only, such as Church group"
              maxLength={60}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            <TextField
              label="Uses allowed"
              inputMode="numeric"
              value={uses}
              onChange={(event) => setUses(event.target.value)}
            />
            <TextField
              label="Expires on (optional)"
              type="date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
            <Button type="submit" variant="primary" loading={busy}>
              Create code
            </Button>
          </form>
          {error ? (
            <p className="adm-field__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Card>

      <section className="adm-card adm-table-card" aria-labelledby="codes-h">
        <h2 className="adm-h3" id="codes-h">
          Codes
        </h2>
        {rows.length === 0 ? (
          <p className="adm-muted" style={{ padding: 'var(--space-4)', margin: 0 }}>
            No invite codes yet
          </p>
        ) : (
          <table className="adm-table adm-table--always adm-table--sticky">
            <caption className="adm-sr">Sign up invite codes</caption>
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Code</th>
                <th scope="col" className="adm-num">Uses</th>
                <th scope="col">Expires</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="adm-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.label || 'No label'}</th>
                  <td>Ends in {item.hint}</td>
                  <td className="adm-num">
                    {item.uses} of {item.maxUses}
                  </td>
                  <td>{item.expiresAt ? formatDate(item.expiresAt) : 'Never'}</td>
                  <td>
                    <Badge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Badge>
                  </td>
                  <td>
                    {item.status === 'active' ? (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        aria-label={`Revoke code ${item.label || `ending in ${item.hint}`}`}
                        onClick={() => setRevoking(item)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ConfirmDialog
        open={revoking !== null}
        title="Revoke this code?"
        consequence="Nobody can sign up with it afterwards. Accounts already made with it are not affected."
        confirmLabel="Revoke code"
        danger
        busy={busy}
        onClose={() => setRevoking(null)}
        onConfirm={() => void revoke()}
      />
    </div>
  );
}
