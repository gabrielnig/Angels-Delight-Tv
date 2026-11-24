// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DevicesCard } from './DevicesPanel';

const devices = [
  {
    id: 'd1',
    label: 'Chrome on Android',
    place: 'Lagos, Nigeria',
    lastActive: 'Active now',
    current: true,
  },
  {
    id: 'd2',
    label: 'Safari on iPhone',
    place: 'Ibadan, Nigeria',
    lastActive: '2 days ago',
    current: false,
  },
  {
    id: 'd3',
    label: 'Edge on Windows',
    place: 'Abuja, Nigeria',
    lastActive: 'Yesterday',
    current: false,
  },
];
const noop = vi.fn();

describe('DevicesCard', () => {
  it('lists each device with place and last active, the current one badged and without Sign out', () => {
    render(<DevicesCard devices={devices} onRevoke={noop} onRevokeOthers={noop} />);
    expect(screen.getByRole('heading', { name: 'Where you are signed in' })).toBeInTheDocument();
    expect(screen.getByText('Lagos, Nigeria, Active now')).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Sign out Safari|^Sign out Edge/ })).toHaveLength(
      2,
    );
    expect(screen.queryByRole('button', { name: 'Sign out Chrome on Android' })).toBeNull();
  });

  it('signs one device out', async () => {
    const onRevoke = vi.fn();
    render(<DevicesCard devices={devices} onRevoke={onRevoke} onRevokeOthers={noop} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out Safari on iPhone' }));
    expect(onRevoke).toHaveBeenCalledWith('d2');
  });

  it('state 4: the confirm dialog names the devices and the consequence', async () => {
    const onRevokeOthers = vi.fn();
    const user = userEvent.setup();
    render(<DevicesCard devices={devices} onRevoke={noop} onRevokeOthers={onRevokeOthers} />);
    await user.click(screen.getByRole('button', { name: 'Sign out all other devices' }));
    const dialog = screen.getByRole('dialog', { name: 'Sign out all other devices?' });
    expect(
      within(dialog).getByText(
        'This signs you out on Safari on iPhone and Edge on Windows. You stay signed in here.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Sign out 2 devices' }));
    expect(onRevokeOthers).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancel closes the dialog without signing anyone out', async () => {
    const onRevokeOthers = vi.fn();
    const user = userEvent.setup();
    render(<DevicesCard devices={devices} onRevoke={noop} onRevokeOthers={onRevokeOthers} />);
    await user.click(screen.getByRole('button', { name: 'Sign out all other devices' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onRevokeOthers).not.toHaveBeenCalled();
  });

  it('hides the sign out all button when there is only this device', () => {
    render(<DevicesCard devices={devices.slice(0, 1)} onRevoke={noop} onRevokeOthers={noop} />);
    expect(screen.queryByRole('button', { name: 'Sign out all other devices' })).toBeNull();
  });

  it('S176: Sign out everywhere asks for the password and says this device is included', async () => {
    const onSignOutEverywhere = vi.fn(async () => ({ ok: true as const }));
    const user = userEvent.setup();
    render(
      <DevicesCard
        devices={devices}
        onRevoke={noop}
        onRevokeOthers={noop}
        onSignOutEverywhere={onSignOutEverywhere}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }));
    const dialog = screen.getByRole('dialog', { name: 'Sign out everywhere?' });
    expect(within(dialog).getByText(/including this one/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Your password'), 'river-lantern-42');
    await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }));
    expect(onSignOutEverywhere).toHaveBeenCalledWith('river-lantern-42');
  });

  it('S176: a wrong password keeps the dialog open with a message', async () => {
    const onSignOutEverywhere = vi.fn(async () => ({
      ok: false as const,
      reason: 'wrong_password' as const,
    }));
    const user = userEvent.setup();
    render(
      <DevicesCard
        devices={devices}
        onRevoke={noop}
        onRevokeOthers={noop}
        onSignOutEverywhere={onSignOutEverywhere}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Your password'), 'nope');
    await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }));
    expect(await within(dialog).findByText('That password is not right.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not offer Sign out everywhere when no handler is given', () => {
    render(<DevicesCard devices={devices} onRevoke={noop} onRevokeOthers={noop} />);
    expect(screen.queryByRole('button', { name: 'Sign out everywhere' })).toBeNull();
  });

  it('shows a tv or tablet icon from the device kind', () => {
    const { container } = render(
      <DevicesCard
        devices={[
          { ...devices[0]!, kind: 'tv' as const },
          { ...devices[1]!, kind: 'tablet' as const },
        ]}
        onRevoke={noop}
        onRevokeOthers={noop}
      />,
    );
    expect(container.querySelectorAll('[data-icon="tv"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-icon="tablet"]')).toHaveLength(1);
  });
});
