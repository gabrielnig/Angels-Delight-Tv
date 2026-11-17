'use client';

import { useMemo, useState } from 'react';
import type { AccountRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import { formatDateTime, fromLagosInput } from '@/lib/admin/format';
import type { ChecklistItem } from '@/lib/data/admin/types';
import type { CommandResult, PublishRequest } from '@/lib/data/admin/video-commands';
import { Button } from './Button';
import { Checklist } from './ChecklistCard';
import { Dialog } from './Dialog';
import { TextArea, TextField } from './fields';
import { Banner } from './states';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  checklist: ChecklistItem[];
  role: AccountRole;
  publish: (request: PublishRequest) => Promise<CommandResult>;
  onDone: (mode: 'now' | 'schedule') => void;
  now?: number;
}

/** Publish now or schedule (SCREEN-ARCHITECTURE 47). Times are Africa/Lagos, UTC+1 all year. */
export function PublishDialog({
  open,
  onClose,
  title,
  checklist,
  role,
  publish,
  onDone,
  now = Date.now(),
}: Props) {
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open_ = checklist.filter((item) => !item.done);
  const onlyCaptions = open_.length > 0 && open_.every((item) => item.key === 'captions');
  const canOverride = onlyCaptions && can(role, 'caption.override');
  const blocked = open_.length > 0 && !(canOverride && override);
  const scheduledIso = useMemo(
    () => (date ? fromLagosInput(`${date}T${time}`) : null),
    [date, time],
  );
  const pastError =
    mode === 'schedule' && scheduledIso !== null && Date.parse(scheduledIso) <= now
      ? `Pick a time in the future. It is ${formatDateTime(new Date(now).toISOString())} now in Lagos.`
      : null;
  const confirmLabel =
    mode === 'now'
      ? 'Publish now'
      : scheduledIso && !pastError
        ? `Schedule for ${formatDateTime(scheduledIso)}`
        : 'Schedule';
  const missingDate = mode === 'schedule' && !scheduledIso;
  const reasonShort = canOverride && override && reason.trim().length < 5;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const request: PublishRequest =
        mode === 'now' ? { mode } : { mode, at: scheduledIso ?? undefined };
      if (canOverride && override) request.overrideReason = reason;
      const result = await publish(request);
      if (result.ok) onDone(mode);
      else setError(result.error);
    } catch {
      setError('That did not work. Nothing was changed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'now' ? 'Publish this video' : 'Schedule this video'}
      description={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabledReason={
              blocked
                ? 'Finish the steps above first.'
                : missingDate
                  ? 'Pick a date and time.'
                  : pastError
                    ? 'Pick a time in the future.'
                    : reasonShort
                      ? 'Add a reason.'
                      : undefined
            }
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <fieldset className="adm-radios">
        <legend className="adm-field__label">When should it go live?</legend>
        <label className="adm-radio">
          <input
            type="radio"
            name="when"
            checked={mode === 'now'}
            onChange={() => setMode('now')}
          />
          <span>
            <strong>Publish now</strong>
            <span className="adm-muted"> Viewers can watch it right away.</span>
          </span>
        </label>
        <label className="adm-radio">
          <input
            type="radio"
            name="when"
            checked={mode === 'schedule'}
            onChange={() => setMode('schedule')}
          />
          <span>
            <strong>Schedule</strong>
            <span className="adm-muted"> Pick a date and time.</span>
          </span>
        </label>
      </fieldset>

      {mode === 'schedule' ? (
        <div className="adm-stack">
          <div className="adm-grid-2">
            <TextField
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <TextField
              label="Time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              error={pastError ?? undefined}
            />
          </div>
          <p className="adm-muted" style={{ margin: 0 }}>
            Time zone: Africa/Lagos (WAT, UTC+1). Viewers see it when the time comes.
          </p>
        </div>
      ) : null}

      {open_.length > 0 ? (
        <Banner tone="warning">
          <strong>
            {open_.length === 1
              ? '1 step is not finished.'
              : `${open_.length} steps are not finished.`}
          </strong>{' '}
          {open_.length === 1
            ? open_[0]!.detail
            : 'Finish them before this video can be published.'}
        </Banner>
      ) : null}
      <Checklist items={checklist} compact />

      {canOverride ? (
        <fieldset className="adm-stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="adm-field__label">Admin override</legend>
          <label className="adm-check">
            <input
              type="checkbox"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
            />
            <span>Publish without approved captions</span>
          </label>
          {override ? (
            <TextArea
              label="Reason (required)"
              hint="Tell us why. It goes in the audit log."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          ) : null}
        </fieldset>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}
    </Dialog>
  );
}
