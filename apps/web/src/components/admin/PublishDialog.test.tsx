// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { publishChecklist, videoStub } from '@/lib/data/admin/video-rules';
import { PublishDialog } from './PublishDialog';

const NOW = Date.parse('2026-11-17T09:30:00Z');
const ready = videoStub({
  id: 'v',
  title: 'Staying Safe Online',
  description: 'Learn how to spot fake messages and stay safe.',
  status: 'ready',
  captionState: 'approved',
  posterId: 'p',
  suitability: 'everyone',
});
const needsCaptions = { ...ready, captionState: 'needs_review' as const };

function setup(
  video = ready,
  role: 'admin' | 'editor' = 'editor',
  publish: Parameters<typeof PublishDialog>[0]['publish'] = vi.fn(async () => ({
    ok: true as const,
  })),
) {
  const onDone = vi.fn();
  render(
    <PublishDialog
      open
      onClose={() => {}}
      title={video.title}
      checklist={publishChecklist(video)}
      role={role}
      publish={publish}
      onDone={onDone}
      now={NOW}
    />,
  );
  return { publish, onDone };
}

describe('PublishDialog', () => {
  it('publishes now when every step is done', async () => {
    const { publish, onDone } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Publish now' }));
    expect(publish).toHaveBeenCalledWith({ mode: 'now' });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('now'));
  });

  it('blocks Publish and explains when captions are not approved', () => {
    setup(needsCaptions);
    expect(screen.getByRole('button', { name: /Publish now/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('1 step is not finished.')).toBeInTheDocument();
    expect(screen.getAllByText(/Captions need review/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Admin override')).toBeNull();
  });

  it('lets an admin override with a reason and sends it', async () => {
    const { publish } = setup(needsCaptions, 'admin');
    await userEvent.click(screen.getByLabelText('Publish without approved captions'));
    expect(screen.getByRole('button', { name: /Publish now/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.type(screen.getByLabelText('Reason (required)'), 'Music only video');
    await userEvent.click(screen.getByRole('button', { name: 'Publish now' }));
    expect(publish).toHaveBeenCalledWith({ mode: 'now', overrideReason: 'Music only video' });
  });

  it('shows a past time error in Lagos time and disables Schedule', async () => {
    setup();
    await userEvent.click(screen.getByLabelText(/Schedule/));
    await userEvent.type(screen.getByLabelText('Date'), '2026-11-17');
    await userEvent.clear(screen.getByLabelText('Time'));
    await userEvent.type(screen.getByLabelText('Time'), '08:00');
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a time in the future. It is');
    expect(screen.getByRole('button', { name: /^Schedule/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('schedules a future time with the Africa/Lagos label and sends UTC', async () => {
    const { publish } = setup();
    await userEvent.click(screen.getByLabelText(/Schedule/));
    await userEvent.type(screen.getByLabelText('Date'), '2026-11-20');
    expect(screen.getByText(/Africa\/Lagos \(WAT, UTC\+1\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Schedule for/ }));
    expect(publish).toHaveBeenCalledWith({ mode: 'schedule', at: '2026-11-20T08:00:00.000Z' });
  });

  it('shows a server refusal inside the dialog', async () => {
    setup(
      ready,
      'editor',
      vi.fn(async () => ({
        ok: false as const,
        error: 'Not ready: Poster still needs attention.',
      })),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish now' }));
    expect(await screen.findByText('Not ready: Poster still needs attention.')).toBeInTheDocument();
  });
});
