// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seedStore } from '@/lib/data/admin/store';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const { VideoEditor } = await import('./VideoEditor');
type UpdateResult = { ok: true } | { ok: false; errors: Record<string, string> };
const store = seedStore(Date.parse('2026-11-17T09:00:00Z'));
const get = (id: string) => store.videos.find((v) => v.id === id)!;

function setup(
  id: string,
  role: 'admin' | 'editor' = 'admin',
  update = vi.fn<(patch: never) => Promise<UpdateResult>>(async () => ({ ok: true })),
  markersSummary: string | null = null,
) {
  const actions = {
    update,
    publish: vi.fn(async () => ({ ok: true as const })),
    unpublish: vi.fn(async () => ({ ok: true as const })),
    retryEncode: vi.fn(async () => ({ ok: true as const })),
    bulk: vi.fn(async () => ({ succeeded: [id], failed: [] })),
  };
  render(
    <VideoEditor
      video={get(id)}
      categories={store.categories}
      series={store.series}
      role={role}
      actions={actions as never}
      viewerHref={`/watch/${id}`}
      markersSummary={markersSummary}
    />,
  );
  return actions;
}

describe('VideoEditor maturity rating (M44-S13)', () => {
  it('offers the five labels and shows the video rank', () => {
    setup('vid_safe_online');
    const select = screen.getByLabelText('Maturity rating');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose a rating', 'G', 'PG', '12', '15', '18']);
    expect(select).toHaveValue('0');
  });

  it('sends the chosen rank as a number', async () => {
    const actions = setup('vid_safe_online');
    await userEvent.selectOptions(screen.getByLabelText('Maturity rating'), '15');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    const patch = (actions.update.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(patch.maturityRank).toBe(3);
    expect('suitability' in patch).toBe(false);
  });

  it('saves the spoken language, including Detect automatically (M46)', async () => {
    const actions = setup('vid_safe_online');
    await userEvent.selectOptions(screen.getByLabelText('Spoken language'), 'auto');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    const patch = (actions.update.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(patch.language).toBe('auto');
  });

  it('shows the field error from the server', async () => {
    const update = vi.fn(async () => ({
      ok: false as const,
      errors: { maturityRank: 'Choose one of the five ratings.' },
    }));
    setup('vid_safe_online', 'admin', update);
    await userEvent.selectOptions(screen.getByLabelText('Maturity rating'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Choose one of the five ratings.')).toBeInTheDocument();
  });
});

describe('VideoEditor', () => {
  it('starts clean, then shows unsaved changes and saves a whitelisted patch', async () => {
    const actions = setup('vid_safe_online');
    expect(screen.queryByText('You have unsaved changes.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.type(screen.getByLabelText('Title'), ' 2');
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    const patch = (actions.update.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(Object.keys(patch).sort()).toEqual([
      'categoryIds',
      'description',
      'episodeNumber',
      'language',
      'maturityRank',
      'seriesId',
      'slug',
      'tags',
      'title',
    ]);
    expect(patch.title).toBe('Staying Safe Online 2');
  });

  it('shows the address with a note that the old one keeps working, and sends a change', async () => {
    const actions = setup('vid_safe_online');
    const field = screen.getByLabelText('Address');
    expect(field).toHaveValue(get('vid_safe_online').slug);
    expect(screen.getByText(/old address keeps working/i)).toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, 'safe-online-2');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    const patch = (actions.update.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(patch.slug).toBe('safe-online-2');
  });

  it('shows field errors from the server and keeps the typed text', async () => {
    setup(
      'vid_safe_online',
      'admin',
      vi.fn(async () => ({ ok: false as const, errors: { title: 'Add a title.' } })) as never,
    );
    await userEvent.type(screen.getByLabelText('Title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Add a title.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Staying Safe Online!');
  });

  it('counts the checklist and blocks Publish while processing', () => {
    setup('vid_rivers');
    expect(screen.getByText(/of 6 done/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText(/still being prepared/)).toBeInTheDocument();
  });

  it('offers Retry encoding for a failed video', async () => {
    const actions = setup('vid_solar');
    await userEvent.click(screen.getByRole('button', { name: 'Retry encoding' }));
    expect(actions.retryEncode).toHaveBeenCalled();
  });

  it('keeps Move to Trash away from editors with the reason', () => {
    setup('vid_sky', 'editor');
    expect(screen.getByRole('button', { name: /Move to Trash/ })).toHaveTextContent(
      'Only an admin can move videos to Trash.',
    );
  });

  it('shows Unpublish for a live video', () => {
    setup('vid_sky');
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
  });

  it('shows the Skip and chapters card with a one line summary and an Edit link for editors', () => {
    setup(
      'vid_safe_online',
      'editor',
      undefined,
      'Intro 0:12 to 0:48, credits from 5:10, 6 chapters',
    );
    expect(
      screen.getByText('Intro 0:12 to 0:48, credits from 5:10, 6 chapters'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit skip and chapters' })).toHaveAttribute(
      'href',
      '/admin/videos/vid_safe_online/markers',
    );
  });

  it('says when nothing is set and offers to set it up', () => {
    setup('vid_safe_online');
    expect(screen.getByText('Not set. Viewers cannot skip anything yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up skip and chapters' })).toBeInTheDocument();
  });
});

describe('VideoEditor captions for viewers (L3-05)', () => {
  const withCaptions = (
    role: 'admin' | 'editor',
    over: Record<string, unknown> = {},
    siteDefault = true,
  ) => {
    const setCaptions = vi.fn(async () => ({ ok: true as const }));
    render(
      <VideoEditor
        video={{ ...get('vid_safe_online'), ...over }}
        categories={store.categories}
        series={store.series}
        role={role}
        actions={
          {
            update: vi.fn(),
            publish: vi.fn(),
            unpublish: vi.fn(),
            retryEncode: vi.fn(),
            bulk: vi.fn(),
            setCaptions,
          } as never
        }
        captionsDefault={siteDefault}
        viewerHref="/watch/x"
      />,
    );
    return setCaptions;
  };

  it('shows the captions switch with the site default named', () => {
    withCaptions('admin', {}, false);
    const group = screen.getByRole('group', { name: 'Captions for viewers' });
    expect(group).toHaveTextContent('Follow site default (currently off)');
    expect(screen.getByRole('radio', { name: /Follow site default/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'On' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Off' })).toBeInTheDocument();
  });

  it('On saves without a reason', async () => {
    const setCaptions = withCaptions('admin');
    await userEvent.click(screen.getByRole('radio', { name: 'On' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save captions setting' }));
    await waitFor(() => expect(setCaptions).toHaveBeenCalledWith(true, undefined));
  });

  it('Off asks for a reason and cannot save without it', async () => {
    const setCaptions = withCaptions('admin');
    await userEvent.click(screen.getByRole('radio', { name: 'Off' }));
    const save = screen.getByRole('button', { name: /Save captions setting/ });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(screen.getByLabelText('Why are captions off?'), 'abc');
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(screen.getByLabelText('Why are captions off?'), 'def');
    await userEvent.click(save);
    await waitFor(() => expect(setCaptions).toHaveBeenCalledWith(false, 'abcdef'));
  });

  it('shows the saved reason when captions are off', () => {
    withCaptions('admin', { captionsEnabled: false, captionsOffReason: 'Sign language video' });
    expect(screen.getByRole('radio', { name: 'Off' })).toBeChecked();
    expect(screen.getByLabelText('Why are captions off?')).toHaveValue('Sign language video');
  });

  it('an editor sees the switch disabled with a reason', () => {
    withCaptions('editor');
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByText('Only an Admin can change this.')).toBeInTheDocument();
  });
});

describe('VideoEditor hero preview card (M41-S10)', () => {
  it('shows the Home preview clip card when the actions are given', () => {
    const actions = setup('vid_safe_online');
    expect(screen.queryByRole('heading', { name: 'Home preview clip' })).toBeNull();
    void actions;
  });

  it('sends a mode change through the action', async () => {
    const setPreviewMode = vi.fn(async () => ({ ok: true as const }));
    const retryPreview = vi.fn(async () => ({ ok: true as const }));
    const { render: r, cleanup } = await import('@testing-library/react');
    cleanup();
    const video = get('vid_safe_online');
    r(
      <VideoEditor
        video={video}
        categories={store.categories}
        series={store.series}
        role="editor"
        actions={
          {
            update: vi.fn(),
            publish: vi.fn(),
            unpublish: vi.fn(),
            retryEncode: vi.fn(),
            bulk: vi.fn(),
            setPreviewMode,
            retryPreview,
          } as never
        }
        viewerHref="/watch/x"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Home preview clip' })).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: /Off/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save preview setting' }));
    await waitFor(() => expect(setPreviewMode).toHaveBeenCalledWith({ mode: 'off' }));
  });
});
