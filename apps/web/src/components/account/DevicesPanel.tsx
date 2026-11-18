'use client';

import { useState } from 'react';
import { Button, Modal } from '@ad/ui';
import type { DeviceSession } from '../../lib/data';
import { AcctIcon } from './icons';

const isDesktop = (label: string) => /windows|mac|linux|chromebook|desktop/i.test(label);

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Signed in devices (S28). Pure view: the page owns the list and the toasts. */
export function DevicesCard({
  devices,
  onRevoke,
  onRevokeOthers,
}: {
  devices: DeviceSession[];
  onRevoke: (id: string) => void | Promise<void>;
  onRevokeOthers: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const others = devices.filter((d) => !d.current);
  const count = `${others.length} ${others.length === 1 ? 'device' : 'devices'}`;
  return (
    <section className="acct-card" data-gap="2" aria-labelledby="acct-devices">
      <div className="acct-row acct-devices__head" data-between data-wrap data-tight>
        <h2 id="acct-devices" className="acct-h2">
          Where you are signed in
        </h2>
        {others.length > 0 ? (
          <Button variant="danger-outline" onClick={() => setConfirming(true)}>
            Sign out all other devices
          </Button>
        ) : null}
      </div>
      <ul className="acct-devices">
        {devices.map((d) => (
          <li key={d.id} className="acct-device">
            <div className="acct-device__lead">
              <AcctIcon name={isDesktop(d.label) ? 'laptop' : 'phone'} size={24} />
              <div className="acct-col">
                <span className="acct-device__label">{d.label}</span>
                <span className="acct-muted acct-small">{`${d.place}, ${d.lastActive}`}</span>
              </div>
            </div>
            {d.current ? (
              <span className="acct-badge" data-tone="info">
                This device
              </span>
            ) : (
              <Button
                variant="secondary"
                aria-label={`Sign out ${d.label}`}
                onClick={() => void onRevoke(d.id)}
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Sign out all other devices?"
        className="acct-dialog"
        hideClose
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                void onRevokeOthers();
              }}
            >
              {`Sign out ${count}`}
            </Button>
          </>
        }
      >
        <p className="acct-muted">{`This signs you out on ${joinNames(others.map((d) => d.label))}. You stay signed in here.`}</p>
      </Modal>
    </section>
  );
}
