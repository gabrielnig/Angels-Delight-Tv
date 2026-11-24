// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seedStore } from '@/lib/data/admin/store';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const { VideoEditor } = await import('./VideoEditor');
const store = seedStore(Date.parse('2026-11-17T09:00:00Z'));
const get = (id: string) => store.videos.find((v) => v.id === id)!;

function setup(
  id: string,
  role: 'admin' | 'editor' = 'admin',
  update = vi.fn(async () => ({ ok: true as const })),
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
      'seriesId',
      'slug',
      'suitability',
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
    setup('vid_safe_online', 'editor', undefined, 'Intro 0:12 to 0:48, credits from 5:10, 6 chapters');
    expect(screen.getByText('Intro 0:12 to 0:48, credits from 5:10, 6 chapters')).toBeInTheDocument();
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
