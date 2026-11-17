// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InAppBrowserNotice, InstallBanner, IosInstructions } from './InstallBanner';

describe('install UI (S37)', () => {
  it('offers Install and Not now with the platform name', async () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();
    render(<InstallBanner platformName="Hope TV" onInstall={onInstall} onDismiss={onDismiss} />);
    expect(screen.getByRole('heading', { name: 'Add Hope TV to your phone' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Install' }));
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onInstall).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('explains the three iPhone steps and closes', async () => {
    const onClose = vi.fn();
    render(<IosInstructions onClose={onClose} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Choose Add to Home Screen')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('tells in app browser users to open Safari and offers to copy the link', async () => {
    const onCopy = vi.fn();
    render(<InAppBrowserNotice onCopy={onCopy} onClose={() => {}} />);
    expect(screen.getByText('Open this page in Safari.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy page link' }));
    expect(onCopy).toHaveBeenCalled();
  });
});
