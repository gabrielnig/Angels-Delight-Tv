// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock('../../app/actions', () => ({ signOutAction: vi.fn(), updateNameAction: vi.fn() }));

import { AccountOverview, formatMinutes } from './AccountOverview';
import { AccountLoadError, AccountOverviewSkeleton, AdultsOnly } from './AccountStates';
import { EditName } from './EditName';

const overview = {
  displayName: 'Chinedu Okafor',
  email: 'chinedu.okafor@example.com',
  verified: true,
  memberSince: '3 Mar 2026',
  watchedThisMonth: 14,
  minutesLearning: 220,
  myListCount: 9,
  devices: 3,
  passwordChanged: '12 Aug 2026',
};
const profiles = [
  { id: 'p1', name: 'Chinedu', kids: false, owner: true },
  { id: 'p2', name: 'Amaka', kids: false, owner: false },
  { id: 'p3', name: 'Tunde', kids: false, owner: false },
  { id: 'p4', name: 'Ify', kids: true, owner: false },
];
const props = {
  overview,
  profiles,
  maxProfiles: 5,
  currentDevice: 'Chrome on Android, Lagos',
};

describe('AccountOverview state 1: default', () => {
  it('shows the full email, the verified badge and the member since line', () => {
    render(<AccountOverview {...props} />);
    const card = screen.getByRole('region', { name: 'Chinedu Okafor' });
    expect(
      within(card).getByRole('heading', { name: 'Chinedu Okafor', level: 2 }),
    ).toBeInTheDocument();
    expect(within(card).getByText('chinedu.okafor@example.com')).toBeInTheDocument();
    expect(within(card).getByText('Email verified')).toBeInTheDocument();
    expect(within(card).getByText('Member since 3 Mar 2026')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Edit name' })).toBeInTheDocument();
  });

  it('hides the verified badge for an unverified address', () => {
    render(<AccountOverview {...props} overview={{ ...overview, verified: false }} />);
    expect(screen.queryByText('Email verified')).toBeNull();
  });

  it('shows the three stats with units', () => {
    render(<AccountOverview {...props} />);
    const stats = screen.getByText('Time learning').closest('dl') as HTMLElement;
    expect(stats.getAttribute('role')).toBeNull();
    expect(within(stats).getByText('Watched this month').nextSibling).toHaveTextContent(
      '14 videos',
    );
    expect(within(stats).getByText('Time learning').nextSibling).toHaveTextContent('3 hr 40 min');
    expect(within(stats).getByText('My List').nextSibling).toHaveTextContent('9 titles');
  });

  it('formats minutes and singular units', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(40)).toBe('40 min');
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(220)).toBe('3 hr 40 min');
    render(
      <AccountOverview
        {...props}
        overview={{ ...overview, watchedThisMonth: 1, myListCount: 1 }}
      />,
    );
    expect(screen.getByText('1 video')).toBeInTheDocument();
    expect(screen.getByText('1 title')).toBeInTheDocument();
  });

  it('lists profiles with Owner and Kids tags, the manage link and the limit note', () => {
    render(<AccountOverview {...props} />);
    const card = screen.getByRole('region', { name: 'Profiles' });
    expect(within(card).getAllByRole('listitem')).toHaveLength(4);
    expect(within(card).getByText('Owner')).toBeInTheDocument();
    expect(within(card).getByText('Kids')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Manage profiles' })).toHaveAttribute(
      'href',
      '/profiles/manage',
    );
    expect(
      within(card).getByText(
        'Up to 5 profiles per account. Kids profiles show only content made for children.',
      ),
    ).toBeInTheDocument();
  });

  it('has chevron rows to the three settings pages with the mockup hints', () => {
    render(<AccountOverview {...props} />);
    const rows: [string, string, string][] = [
      ['Security', '/account/security', 'Password, email and signed in devices'],
      ['Playback settings', '/settings/playback', 'Autoplay, video quality and captions'],
      ['Data and privacy', '/account/data', 'Export your data or delete your account'],
    ];
    for (const [label, href, hint] of rows) {
      const link = screen.getByRole('link', { name: new RegExp(label) });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveTextContent(hint);
    }
  });

  it('shows the devices card with the current device and a Sign out button', () => {
    render(<AccountOverview {...props} />);
    const card = screen.getByRole('region', { name: 'Signed in on 3 devices' });
    expect(within(card).getByText('This device: Chrome on Android, Lagos')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('says one device in the singular', () => {
    render(<AccountOverview {...props} overview={{ ...overview, devices: 1 }} />);
    expect(screen.getByRole('region', { name: 'Signed in on 1 device' })).toBeInTheDocument();
  });
});

describe('AccountOverview state 2: loading skeleton', () => {
  it('is a labelled busy region with no data text', () => {
    const { container } = render(<AccountOverviewSkeleton />);
    const region = screen.getByRole('status', { name: 'Loading your account' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.acct-skel').length).toBeGreaterThanOrEqual(10);
    expect(region.textContent).toBe('');
  });
});

describe('AccountOverview state 3: error loading account', () => {
  it('names the problem, offers Retry and quotes the reference', async () => {
    const retry = vi.fn();
    render(
      <AccountLoadError
        title="We could not load your account"
        supportEmail="support@angelsdelight.tv"
        reference="ERR-4M8Q-310A"
        onRetry={retry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load your account');
    expect(
      screen.getByText('Something went wrong on our side. Try again in a moment.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalled();
    expect(
      screen.getByText(
        'If this keeps happening, email support@angelsdelight.tv and quote reference ERR-4M8Q-310A.',
      ),
    ).toBeInTheDocument();
  });

  it('leaves the reference out when there is none', () => {
    render(
      <AccountLoadError
        title="x"
        supportEmail="support@angelsdelight.tv"
        onRetry={() => undefined}
      />,
    );
    expect(
      screen.getByText('If this keeps happening, email support@angelsdelight.tv.'),
    ).toBeInTheDocument();
  });
});

describe('AccountOverview state 4: kids profile active', () => {
  it('says the account is for adults and offers Switch profile and Back to Home', () => {
    render(<AdultsOnly profileName="Ify" />);
    expect(screen.getByRole('heading', { name: 'Account is for adults' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "You are in Ify's Kids profile. Switch to an adult profile to open account settings.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Switch profile' })).toHaveAttribute(
      'href',
      '/profiles?switch=1',
    );
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });
});

describe('EditName', () => {
  it('opens a dialog, saves the new name and refreshes', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, name: 'Ada Obi' });
    const user = userEvent.setup();
    render(<EditName name="Chinedu Okafor" save={save} />);
    await user.click(screen.getByRole('button', { name: 'Edit name' }));
    const field = screen.getByLabelText('Your name');
    expect(field).toHaveValue('Chinedu Okafor');
    await user.clear(field);
    await user.type(field, 'Ada Obi');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ name: 'Ada Obi' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows an inline error and keeps the dialog open when the name is refused', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, reason: 'invalid' });
    const user = userEvent.setup();
    render(<EditName name="Chinedu Okafor" save={save} />);
    await user.click(screen.getByRole('button', { name: 'Edit name' }));
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Enter a name of 1 to 80 characters.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('cancels without saving', async () => {
    const save = vi.fn();
    const user = userEvent.setup();
    render(<EditName name="Chinedu Okafor" save={save} />);
    await user.click(screen.getByRole('button', { name: 'Edit name' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
