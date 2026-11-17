'use client';

import { useState } from 'react';
import { Badge, Button, useToast } from '@ad/ui';
import { revokeDeviceAction, revokeOtherDevicesAction } from '../../app/actions';
import type { DeviceSession } from '../../lib/data';

export function DevicesPanel({ initial }: { initial: DeviceSession[] }) {
  const [devices, setDevices] = useState(initial);
  const toast = useToast();
  const others = devices.filter((d) => !d.current);

  async function revoke(id: string) {
    try {
      await revokeDeviceAction(id);
      setDevices((d) => d.filter((x) => x.id !== id));
      toast.show({ message: 'Device signed out.', variant: 'success' });
    } catch {
      toast.show({ message: 'We could not sign that device out. Try again.', variant: 'error' });
    }
  }

  async function revokeAll() {
    try {
      await revokeOtherDevicesAction();
      setDevices((d) => d.filter((x) => x.current));
      toast.show({ message: 'Other devices signed out.', variant: 'success' });
    } catch {
      toast.show({
        message: 'We could not sign the other devices out. Try again.',
        variant: 'error',
      });
    }
  }

  return (
    <div>
      <ul className="web-devices">
        {devices.map((d) => (
          <li key={d.id} className="web-device">
            <span>
              <strong>{d.label}</strong>{' '}
              {d.current ? <Badge variant="info">This device</Badge> : null}
              <br />
              <span className="web-episode__blurb">{`${d.place}. Last active ${d.lastActive}.`}</span>
            </span>
            {d.current ? null : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void revoke(d.id)}
                aria-label={`Sign out ${d.label}`}
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        <Button variant="secondary" onClick={() => void revokeAll()}>
          Sign out all other devices
        </Button>
      ) : null}
    </div>
  );
}
