// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SETTING_DEFS, SETTING_KEYS } from '@ad/theme/client';
import type { InviteCodeDto, PageDto, SiteSettingsDto } from '@/lib/data/admin/site-types';
import { ToastProvider } from '../Toast';
import { SiteSettingsView, type SiteActions } from './SiteSettingsView';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  HTMLElement.prototype.scrollIntoView ??= () => {};
});

const page = (slug: PageDto['slug'], title: string, overrides: Partial<PageDto> = {}): PageDto => ({
  slug,
  title,
  draftBody: `<p>[Add your ${title.toLowerCase()} here before launch]</p>`,
  hasDraft: false,
  published: null,
  versions: [],
  isPlaceholder: true,
  ...overrides,
});

const dto = (
  overrides: Partial<SiteSettingsDto> = {},
  values: Record<string, unknown> = {},
): SiteSettingsDto => ({
  values: {
    ...Object.fromEntries(
      SETTING_KEYS.map((key) => [key, structuredClone(SETTING_DEFS[key].default)]),
    ),
    ...values,
  },
  checklist: [
    {
      id: 'name_tagline',
      label: 'Platform name and tagline',
      done: false,
      detail: 'Add a tagline',
    },
    { id: 'support_email', label: 'Support email', done: true, detail: 'Set' },
    { id: 'terms', label: 'Terms page', done: false, detail: 'Terms page has placeholder text' },
    {
      id: 'privacy',
      label: 'Privacy page',
      done: false,
      detail: 'Privacy page has placeholder text',
    },
    { id: 'domain', label: 'Domain connected', done: false, detail: 'Not set' },
  ],
  pages: {
    terms: page('terms', 'Terms of use'),
    privacy: page('privacy', 'Privacy policy'),
    about: page('about', 'About'),
    help: page('help', 'Help'),
  },
  canChangeFlags: true,
  ...overrides,
});

function setup(initial = dto(), overrides: Partial<SiteActions> = {}, invites?: InviteCodeDto[]) {
  const actions: SiteActions = {
    update: vi.fn(async (changes) => ({ ok: true as const, data: dto({}, changes) })),
    savePage: vi.fn(async (slug, body) => ({
      ok: true as const,
      data: page(slug, 'Terms of use', { draftBody: body, hasDraft: true, isPlaceholder: false }),
    })),
    publishPage: vi.fn(async () => ({
      ok: true as const,
      data: dto({
        pages: {
          ...dto().pages,
          terms: page('terms', 'Terms of use', {
            draftBody: '<p>Real.</p>',
            published: {
              version: 1,
              body: '<p>Real.</p>',
              publishedAt: '2026-11-17T10:00:00.000Z',
            },
            versions: [{ version: 1, publishedAt: '2026-11-17T10:00:00.000Z', publishedBy: 'x' }],
            isPlaceholder: false,
          }),
        },
      }),
    })),
    restorePage: vi.fn(async (slug) => ({
      ok: true as const,
      data: page(slug, 'Terms of use', {
        draftBody: '<p>Old.</p>',
        hasDraft: true,
        isPlaceholder: false,
      }),
    })),
    ...overrides,
  };
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <SiteSettingsView initial={initial} actions={actions} invites={invites} />
    </ToastProvider>,
  );
  return { actions, user };
}

describe('invite codes tab', () => {
  const create = vi.fn();
  const revoke = vi.fn();

  it('is hidden when the person cannot manage invite codes', () => {
    setup();
    expect(screen.queryByRole('tab', { name: 'Invite codes' })).not.toBeInTheDocument();
  });

  it('opens the tab and reflects the sign up setting', async () => {
    const { user } = setup(dto(), { create, revoke }, []);
    await user.click(screen.getByRole('tab', { name: 'Invite codes' }));
    expect(screen.getByText('No invite codes yet')).toBeInTheDocument();
    expect(screen.getByText(/Sign up is open, so visitors do not need a code/)).toBeInTheDocument();
  });
});

describe('launch checklist', () => {
  it('shows how many items are not set and why', () => {
    setup();
    const panel = screen.getByRole('complementary', { name: 'Launch checklist' });
    expect(within(panel).getByText('4 items not set')).toBeInTheDocument();
    expect(within(panel).getByText('Terms page has placeholder text')).toBeInTheDocument();
    expect(within(panel).getByText('Support email')).toBeInTheDocument();
  });
});

describe('platform details', () => {
  it('shows the current values and enables Save only after a change', async () => {
    const { user } = setup();
    expect(screen.getByLabelText('Platform name')).toHaveValue('Angels Delight TV');
    expect(screen.getByRole('button', { name: /save changes/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.type(screen.getByLabelText('Tagline'), 'Short lessons');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('sends only the changed keys', async () => {
    const { actions, user } = setup();
    await user.type(screen.getByLabelText('Tagline'), 'Short lessons');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith({ 'platform.tagline': 'Short lessons' }),
    );
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
  });

  it('says which required value is missing without calling the server', async () => {
    const { actions, user } = setup();
    await user.clear(screen.getByLabelText('Platform name'));
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Platform name is required')).toBeInTheDocument();
    expect(actions.update).not.toHaveBeenCalled();
  });

  it('checks the email and the domain', async () => {
    const { actions, user } = setup();
    await user.type(screen.getByLabelText('Support email'), 'nope');
    await user.type(screen.getByLabelText('Domain'), 'https://x.tv');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText(/without https:\/\//)).toBeInTheDocument();
    expect(actions.update).not.toHaveBeenCalled();
  });

  it('keeps the edits and shows the reason when saving fails', async () => {
    const { user } = setup(dto(), {
      update: vi.fn(async () => ({
        ok: false as const,
        message: 'Something went wrong on our side. Try again.',
      })),
    });
    await user.type(screen.getByLabelText('Tagline'), 'Short lessons');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/Your changes are still here/)).toBeInTheDocument();
    expect(screen.getByLabelText('Tagline')).toHaveValue('Short lessons');
  });

  it('discards changes', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Tagline'), 'x');
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByLabelText('Tagline')).toHaveValue('');
  });

  it('adds and removes social links, https only', async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add a link' }));
    await user.type(screen.getByLabelText('Name'), 'YouTube');
    await user.type(screen.getByLabelText('Link'), 'http://insecure.test');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Use a full https:// link')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Link'));
    await user.type(screen.getByLabelText('Link'), 'https://youtube.com/@x');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    expect(vi.mocked(actions.update).mock.calls[0]![0]['platform.social_links']).toEqual([
      { label: 'YouTube', url: 'https://youtube.com/@x' },
    ]);
  });
});

describe('features and limits', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'Features and limits' }));

  it('toggles a flag and saves it', async () => {
    const { actions, user } = setup();
    await open(user);
    const signup = screen.getByRole('switch', { name: 'Open sign up' });
    expect(signup).toHaveAttribute('aria-checked', 'true');
    await user.click(signup);
    expect(signup).toHaveTextContent('Off');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith({ 'features.signups_open': false }),
    );
  });

  it('shows the range for a number that is out of bounds and saves nothing', async () => {
    const { actions, user } = setup();
    await open(user);
    const input = screen.getByLabelText('Sessions per account');
    await user.clear(input);
    await user.type(input, '11');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Enter a number from 1 to 10')).toBeInTheDocument();
    expect(actions.update).not.toHaveBeenCalled();
  });

  it('rejects text where a number is needed', async () => {
    const { user } = setup();
    await open(user);
    const input = screen.getByLabelText('Profiles per account');
    await user.clear(input);
    await user.type(input, 'lots');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Enter a number from 1 to 10')).toBeInTheDocument();
  });

  it('has an AirPlay switch that starts off and saves when turned on', async () => {
    const { actions, user } = setup();
    await open(user);
    const sw = screen.getByRole('switch', { name: 'AirPlay button' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(actions.update).toHaveBeenCalledWith({ 'features.airplay': true }));
  });

  it('saves a countdown between 5 and 10 and rejects 4 and 11', async () => {
    const { actions, user } = setup();
    await open(user);
    const input = screen.getByLabelText('Next video countdown seconds');
    expect(input).toHaveValue('5');
    for (const bad of ['4', '11']) {
      await user.clear(input);
      await user.type(input, bad);
      await user.click(screen.getByRole('button', { name: /save changes/i }));
      expect(await screen.findByText('Enter a number from 5 to 10')).toBeInTheDocument();
    }
    expect(actions.update).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, '8');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith({ 'playback.countdown_seconds': 8 }),
    );
  });

  it('shows the upload limit in GB and saves bytes', async () => {
    const { actions, user } = setup();
    await open(user);
    const input = screen.getByLabelText('Upload size limit (GB)');
    expect(input).toHaveValue('5');
    await user.clear(input);
    await user.type(input, '2');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith({ 'limits.upload_max_bytes': 2 * 1024 ** 3 }),
    );
  });

  it('only a Super admin can change the captions default', async () => {
    const { actions, user } = setup();
    await open(user);
    const sw = screen.getByRole('switch', { name: 'Captions are available to viewers by default' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await user.click(sw);
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith({ 'features.captions_default_available': false }),
    );
  });

  it('the captions default is locked for roles below Super admin', async () => {
    const { user } = setup(dto({ canChangeFlags: false }));
    await open(user);
    expect(
      screen.getByRole('switch', { name: 'Captions are available to viewers by default' }),
    ).toBeDisabled();
  });

  it('is read only when the role cannot change flags', async () => {
    const { user } = setup(dto({ canChangeFlags: false }));
    await open(user);
    expect(screen.getByText('You can see these settings but not change them.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Open sign up' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });
});

describe('maintenance', () => {
  it('asks before turning maintenance mode on', async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Maintenance' }));
    await user.click(screen.getByRole('switch', { name: 'Maintenance mode' }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Admins can still sign in/)).toBeInTheDocument();
    expect(actions.update).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(actions.update).toHaveBeenCalledWith({ 'maintenance.mode': true }));
  });

  it('saves the banner message without a confirm', async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Maintenance' }));
    await user.type(screen.getByLabelText('Banner message'), 'Short break tonight');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('pages editor', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'Pages' }));

  it('starts with placeholder text and a warning', async () => {
    const { user } = setup();
    await open(user);
    expect(screen.getByText('Placeholder text.')).toBeInTheDocument();
    expect(screen.getByLabelText('Terms of use')).toHaveValue(
      '<p>[Add your terms of use here before launch]</p>',
    );
    expect(screen.getByText(/Nothing published yet/)).toBeInTheDocument();
  });

  it('saves a draft and shows it as saved', async () => {
    const { actions, user } = setup();
    await open(user);
    const box = screen.getByLabelText('Terms of use');
    await user.clear(box);
    await user.type(box, 'Real terms');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(actions.savePage).toHaveBeenCalledWith('terms', 'Real terms'));
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
  });

  it('adds formatting from the toolbar', async () => {
    const { user } = setup();
    await open(user);
    const box = screen.getByLabelText('Terms of use') as HTMLTextAreaElement;
    await user.clear(box);
    await user.type(box, 'hello');
    box.setSelectionRange(0, 5);
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(box).toHaveValue('<strong>hello</strong>');
  });

  it('refuses an unsafe link address', async () => {
    const { user } = setup();
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Link' }));
    await user.type(screen.getByLabelText('Link address'), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    expect(await screen.findByText(/Use a full https/)).toBeInTheDocument();
  });

  it('previews only the safe subset', async () => {
    const { user } = setup();
    await open(user);
    const box = screen.getByLabelText('Terms of use');
    await user.clear(box);
    await user.type(box, '<p>Hi</p><script>alert(1)</script><img src=x onerror=alert(1)>');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    const preview = screen.getByLabelText('Preview of Terms of use');
    expect(preview.innerHTML).toBe('<p>Hi</p>');
  });

  it('publishes a new version and updates the checklist', async () => {
    const { actions, user } = setup();
    await open(user);
    const box = screen.getByLabelText('Terms of use');
    await user.clear(box);
    await user.type(box, 'Real.');
    await user.click(screen.getByRole('button', { name: 'Save new version' }));
    await waitFor(() => expect(actions.publishPage).toHaveBeenCalledWith('terms'));
    expect(await screen.findByText('Terms of use published as version 1.')).toBeInTheDocument();
    expect(screen.getByText('v1, 17 Nov (live)')).toBeInTheDocument();
  });

  it('shows server messages, for example a placeholder that cannot be published', async () => {
    const { user } = setup(dto(), {
      publishPage: vi.fn(async () => ({
        ok: false as const,
        message: 'x',
        fields: { body: ['Replace the placeholder text before publishing.'] },
      })),
    });
    await open(user);
    await user.type(screen.getByLabelText('Terms of use'), ' ');
    await user.click(screen.getByRole('button', { name: 'Save new version' }));
    expect(
      await screen.findByText('Replace the placeholder text before publishing.'),
    ).toBeInTheDocument();
  });

  it('restores an earlier version after a confirm', async () => {
    const withVersions = dto();
    withVersions.pages.terms = page('terms', 'Terms of use', {
      isPlaceholder: false,
      draftBody: '<p>Now</p>',
      published: { version: 2, body: '<p>Now</p>', publishedAt: '2026-11-14T10:00:00.000Z' },
      versions: [
        { version: 2, publishedAt: '2026-11-14T10:00:00.000Z', publishedBy: 'x' },
        { version: 1, publishedAt: '2026-11-02T10:00:00.000Z', publishedBy: 'x' },
      ],
    });
    const { actions, user } = setup(withVersions);
    await open(user);
    expect(screen.queryByRole('button', { name: 'Restore version 2' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore version 1' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Restore as draft' }));
    await waitFor(() => expect(actions.restorePage).toHaveBeenCalledWith('terms', 1));
    expect(await screen.findByLabelText('Terms of use')).toHaveValue('<p>Old.</p>');
  });

  it('switches between pages', async () => {
    const { user } = setup();
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Privacy policy' }));
    expect(screen.getByLabelText('Privacy policy')).toHaveValue(
      '<p>[Add your privacy policy here before launch]</p>',
    );
  });
});

describe('home settings tab', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'Home' }));

  it('shows the hero and row settings with their defaults', async () => {
    const { user } = setup();
    await open(user);
    expect(screen.getByLabelText('Seconds per hero slide')).toHaveValue('20');
    expect(screen.getByLabelText('Seconds per hero clip')).toHaveValue('20');
    expect(screen.getByLabelText('Slowest link that plays clips (Mbps)')).toHaveValue('2');
    expect(screen.getByRole('switch', { name: 'Slide waits for its clip' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Sound button on hero clips' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Hero loops before it stops')).toHaveValue('2');
    expect(screen.getByLabelText('View all label')).toHaveValue('View all');
    expect(screen.getByLabelText('Continue row title')).toHaveValue('Continue learning');
    expect(screen.getByRole('switch', { name: 'Hero preview clips' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('saves a new interval as a number', async () => {
    const { actions, user } = setup();
    await open(user);
    const field = screen.getByLabelText('Seconds per hero slide');
    await user.clear(field);
    await user.type(field, '12');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith({ 'home.hero_interval_seconds': 12 }),
    );
  });

  it('refuses an interval outside 5 to 60', async () => {
    const { actions, user } = setup();
    await open(user);
    const field = screen.getByLabelText('Seconds per hero slide');
    await user.clear(field);
    await user.type(field, '3');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/from 5 to 60/i)).toBeInTheDocument();
    expect(actions.update).not.toHaveBeenCalled();
  });

  it('keeps the unknown connection switch read only without super rights', async () => {
    const { user } = setup(dto({ canChangeFlags: false }));
    await open(user);
    expect(
      screen.getByRole('switch', { name: 'Preview clips on unknown connections' }),
    ).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Hero preview clips' })).toBeEnabled();
  });
});

describe('discovery tab (M45-S05)', () => {
  const open = async (initial = dto()) => {
    const ctx = setup(initial);
    await ctx.user.click(screen.getByRole('tab', { name: 'Discovery' }));
    return ctx;
  };

  it('shows a live search result and share card preview that follow the description', async () => {
    const { user } = await open(dto({}, { 'platform.tagline': 'Learn anything' }));
    expect(screen.getByText('Using the tagline')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Site description'), 'Free lessons for everyone');
    expect(screen.queryByText('Using the tagline')).not.toBeInTheDocument();
    expect(screen.getAllByText('Free lessons for everyone').length).toBeGreaterThan(1);
  });

  it('counts characters and blocks Save past 160', async () => {
    const { user, actions } = await open();
    const field = screen.getByLabelText('Site description');
    await user.click(field);
    await user.paste('x'.repeat(161));
    expect(screen.getByText('161 of 160')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeDisabled();
    expect(actions.update).not.toHaveBeenCalled();
  });

  it('saves the description, social image and share text', async () => {
    const { user, actions } = await open();
    await user.type(screen.getByLabelText('Site description'), 'Free lessons');
    await user.type(screen.getByLabelText('Social image link'), 'https://cdn.example.com/og.jpg');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith(
        expect.objectContaining({
          'seo.site_description': 'Free lessons',
          'seo.default_social_image_url': 'https://cdn.example.com/og.jpg',
        }),
      ),
    );
  });

  it('lists share channels with Copy link always on and Email off', () => {
    return open().then(() => {
      expect(screen.getByRole('switch', { name: 'WhatsApp' })).toBeChecked();
      expect(screen.getByRole('switch', { name: 'Email' })).not.toBeChecked();
      expect(screen.getByText('Copy link is always on')).toBeInTheDocument();
    });
  });

  it('says kids only titles are never listed by search engines', async () => {
    await open();
    expect(screen.getByText(/Kids only titles are never listed/)).toBeInTheDocument();
  });

  it('bumps the notice version so everyone sees the notice again', async () => {
    const { user, actions } = await open();
    await user.click(screen.getByRole('button', { name: 'Show notice again to everyone' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith(
        expect.objectContaining({ 'consent.notice_version': 2 }),
      ),
    );
  });
});

describe('discovery tab search quality (M45-S08, M45-S09)', () => {
  const renderWith = async (
    search?:
      | { synonyms: string; misses: { query: string; hits: number; lastSeen: string }[] | null }
      | { unavailable: true },
  ) => {
    const saveSynonyms = vi.fn(async (text: string) => ({ ok: true as const, synonyms: text }));
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <SiteSettingsView
          initial={dto()}
          actions={{
            update: vi.fn(),
            savePage: vi.fn(),
            publishPage: vi.fn(),
            restorePage: vi.fn(),
            ...(search ? { saveSynonyms } : {}),
          }}
          {...(search ? { search } : {})}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('tab', { name: 'Discovery' }));
    return { saveSynonyms, user };
  };

  it('shows the synonyms editor and the empty search report under the settings', async () => {
    const { saveSynonyms, user } = await renderWith({
      synonyms: 'money, finance',
      misses: [{ query: 'budgetng', hits: 3, lastSeen: new Date().toISOString() }],
    });
    expect(screen.getByRole('textbox', { name: 'One group per line' })).toHaveValue('money, finance');
    expect(screen.getByRole('table', { name: 'Searches with no results' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save synonyms' }));
    expect(saveSynonyms).toHaveBeenCalledWith('money, finance');
  });

  it('shows a plain error instead of an empty editor when the synonyms could not be loaded', async () => {
    await renderWith({ unavailable: true });
    expect(screen.getByText('Search synonyms could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'One group per line' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save synonyms' })).toBeNull();
  });

  it('leaves both cards out when the person may not manage search', async () => {
    await renderWith();
    expect(screen.queryByRole('textbox', { name: 'One group per line' })).toBeNull();
  });
});

describe('series names tab (M51-S01)', () => {
  it('saves a preset as the site default', async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Series names' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Name set' }), 'part_lesson');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith({ 'content.series_labels': { preset: 'part_lesson' } }),
    );
  });

  it('keeps the values and names the field when a custom word is empty', async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Series names' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Name set' }), 'custom');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findAllByText('Enter this word')).not.toHaveLength(0);
    expect(actions.update).not.toHaveBeenCalled();
  });
});
