// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
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

describe('PublishDialog maturity rating gate (S127)', () => {
  const unrated = { ...ready, suitability: null, maturityRank: null };
  const labels = ['G', 'PG', '12', '15', '18'];
  const mount = (
    saveMaturity: (rank: number) => Promise<{ ok: true } | { ok: false; error: string }> = vi.fn(
      async () => ({ ok: true as const }),
    ),
    publish = vi.fn(async () => ({ ok: true as const })),
  ) => {
    render(
      <PublishDialog
        open
        onClose={() => {}}
        title={unrated.title}
        checklist={publishChecklist(unrated)}
        role="editor"
        publish={publish}
        onDone={() => {}}
        now={NOW}
        maturity={{ labels, save: saveMaturity }}
      />,
    );
    return { saveMaturity, publish };
  };

  it('offers the select, keeps Publish enabled and explains on press', async () => {
    const { publish } = mount();
    expect(screen.getByLabelText('Maturity rating (required)')).toHaveValue('');
    const button = screen.getByRole('button', { name: 'Publish now' });
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(
      await screen.findByText(
        'Choose a maturity rating. Publishing needs one so profiles can be limited correctly.',
      ),
    ).toBeInTheDocument();
    expect(publish).not.toHaveBeenCalled();
  });

  it('saves the chosen rating, then publishes', async () => {
    const order: string[] = [];
    const saveMaturity = vi.fn(async () => (order.push('save'), { ok: true as const }));
    const publish = vi.fn(async () => (order.push('publish'), { ok: true as const }));
    mount(saveMaturity, publish);
    await userEvent.selectOptions(screen.getByLabelText('Maturity rating (required)'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Publish now' }));
    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(saveMaturity).toHaveBeenCalledWith(2);
    expect(order).toEqual(['save', 'publish']);
  });

  it('does not publish when the rating cannot be saved', async () => {
    const saveMaturity = vi.fn(async () => ({
      ok: false as const,
      error: 'Edited by someone else.',
    }));
    const { publish } = mount(saveMaturity);
    await userEvent.selectOptions(screen.getByLabelText('Maturity rating (required)'), '15');
    await userEvent.click(screen.getByRole('button', { name: 'Publish now' }));
    expect(await screen.findByText('Edited by someone else.')).toBeInTheDocument();
    expect(publish).not.toHaveBeenCalled();
  });

  it('has no select when the video is rated', () => {
    setup();
    expect(screen.queryByLabelText('Maturity rating (required)')).toBeNull();
  });

  it('lists the five labels', () => {
    mount();
    const select = screen.getByLabelText('Maturity rating (required)');
    expect(within(select).getAllByRole('option')).toHaveLength(6);
  });
});
