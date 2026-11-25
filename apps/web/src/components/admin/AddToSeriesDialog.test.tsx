// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AddToSeriesDialog } from './AddToSeriesDialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const videos = [
  { id: 'c', title: 'Talk 10', uploadedAt: '2026-03-01' },
  { id: 'a', title: 'Talk 2', uploadedAt: '2026-01-01' },
  { id: 'b', title: 'Talk 1', uploadedAt: '2026-02-01' },
];
const series = [{ id: 's1', title: 'Genesis', labels: { preset: 'book_chapter' as const } }];

function setup(over: Partial<React.ComponentProps<typeof AddToSeriesDialog>> = {}) {
  const props = {
    open: true,
    videos,
    series,
    existing: vi.fn(async () => [] as Array<{ group: number; number: number }>),
    setEpisode: vi.fn(async () => ({ ok: true as const })),
    createSeries: vi.fn(async () => ({ ok: true as const, id: 'new1' })),
    onClose: vi.fn(),
    onDone: vi.fn(),
    ...over,
  };
  render(<AddToSeriesDialog {...props} />);
  return props;
}

describe('AddToSeriesDialog (M51-S04)', () => {
  it('previews the numbers in the order picked, with the series words', async () => {
    const user = userEvent.setup();
    setup();
    await user.selectOptions(screen.getByLabelText('Series'), 's1');
    const rows = await screen.findAllByRole('row');
    expect(within(rows[1]!).getByText('Talk 10')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Book 1, Chapter 1')).toBeInTheDocument();
    expect(within(rows[3]!).getByText('Book 1, Chapter 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Book')).toHaveValue(1);
    expect(screen.getByLabelText('Start at Chapter')).toHaveValue(1);
  });

  it('re-orders the preview by title and by upload date', async () => {
    const user = userEvent.setup();
    setup();
    await user.selectOptions(screen.getByLabelText('Series'), 's1');
    await user.selectOptions(screen.getByLabelText('Number them'), 'title');
    let rows = await screen.findAllByRole('row');
    expect(within(rows[1]!).getByText('Talk 1')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Number them'), 'date');
    rows = await screen.findAllByRole('row');
    expect(within(rows[1]!).getByText('Talk 2')).toBeInTheDocument();
  });

  it('saves every video with its number and offers undo that puts them back', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.selectOptions(screen.getByLabelText('Series'), 's1');
    await user.click(screen.getByRole('button', { name: 'Add 3 videos' }));
    await waitFor(() => expect(props.setEpisode).toHaveBeenCalledTimes(3));
    expect(props.setEpisode).toHaveBeenNthCalledWith(1, 'c', 's1', 1, 1);
    expect(props.setEpisode).toHaveBeenNthCalledWith(3, 'b', 's1', 1, 3);
    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    const done = (props.onDone as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { added: number; undo: () => Promise<void> };
    expect(done.added).toBe(3);
    await done.undo();
    expect(props.setEpisode).toHaveBeenCalledWith('c', null, null, null);
    expect(props.setEpisode).toHaveBeenCalledTimes(6);
  });

  it('blocks saving when a number is taken and names the fix', async () => {
    const user = userEvent.setup();
    const props = setup({ existing: vi.fn(async () => [{ group: 1, number: 2 }]) });
    await user.selectOptions(screen.getByLabelText('Series'), 's1');
    expect(await screen.findByText('Chapter 2 is already used in Book 1. Choose another start number.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 3 videos' })).toBeDisabled();
    expect(props.setEpisode).not.toHaveBeenCalled();
  });

  it('creates a new series first, then adds the videos to it', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.selectOptions(screen.getByLabelText('Series'), '__new__');
    await user.type(screen.getByLabelText('New series title'), 'Exodus');
    await user.click(screen.getByRole('button', { name: 'Add 3 videos' }));
    await waitFor(() => expect(props.createSeries).toHaveBeenCalledWith('Exodus'));
    await waitFor(() => expect(props.setEpisode).toHaveBeenCalledWith('c', 'new1', 1, 1));
  });

  it('stops at the first failure and says what was saved', async () => {
    const user = userEvent.setup();
    const setEpisode = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: 'Chapter 2 is taken.' });
    const props = setup({ setEpisode });
    await user.selectOptions(screen.getByLabelText('Series'), 's1');
    await user.click(screen.getByRole('button', { name: 'Add 3 videos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chapter 2 is taken.');
    expect(screen.getByRole('alert')).toHaveTextContent('1 of 3 added');
    expect(props.onDone).not.toHaveBeenCalled();
  });
});
