// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkerEditor, type MarkerEditorProps } from './MarkerEditor';

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

const handle = { time: 134, seeks: [] as number[] };
const fakePlayer = {
  getState: () => ({ currentTime: handle.time }),
  seekTo: (s: number) => void handle.seeks.push(s),
  play: () => undefined,
};

function setup(props: Partial<MarkerEditorProps> = {}) {
  const save = vi.fn().mockResolvedValue({ ok: true });
  const utils = render(
    <MarkerEditor
      video={{ id: 'v1', title: 'Staying safe', durationSeconds: 352 }}
      initial={{ markers: [], chapters: [] }}
      siblings={[]}
      save={save}
      renderPlayer={(onReady) => {
        onReady(fakePlayer as never);
        return <div>player</div>;
      }}
      {...props}
    />,
  );
  return { save, ...utils };
}

const field = (name: RegExp | string) => screen.getByRole('textbox', { name });

beforeEach(() => {
  handle.time = 134;
  handle.seeks = [];
});

describe('MarkerEditor', () => {
  it('fills the start field from the current player time', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Use current time for Intro start' }));
    expect((field('Intro start') as HTMLInputElement).value).toBe('2:14');
  });

  it('rejects an end before the start with an inline message', () => {
    setup();
    fireEvent.change(field('Intro start'), { target: { value: '0:40' } });
    fireEvent.change(field('Intro end'), { target: { value: '0:30' } });
    expect(screen.getByText(/End must be after start/)).toBeTruthy();
    expect(field('Intro end').getAttribute('aria-invalid')).toBe('true');
  });

  it('rejects an intro under 3 seconds and a time past the end of the video', () => {
    setup();
    fireEvent.change(field('Intro start'), { target: { value: '0:12' } });
    fireEvent.change(field('Intro end'), { target: { value: '0:14' } });
    expect(screen.getByText(/at least 3 seconds/)).toBeTruthy();
    fireEvent.change(field('Intro end'), { target: { value: '6:10' } });
    expect(screen.getByText(/after the end of the video \(5:52\)/)).toBeTruthy();
  });

  it('blocks overlapping markers', () => {
    setup();
    fireEvent.change(field('Intro start'), { target: { value: '0:00' } });
    fireEvent.change(field('Intro end'), { target: { value: '1:00' } });
    fireEvent.change(field('Credits start'), { target: { value: '0:40' } });
    expect(screen.getByText(/overlap/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText(/Fix this first/).textContent).toMatch(/overlap/);
  });

  it('warns when credits start before half of the video but still allows saving', async () => {
    const { save } = setup();
    fireEvent.change(field('Credits start'), { target: { value: '1:20' } });
    expect(screen.getByText(/Credits start before half of the video/)).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
    expect(save).toHaveBeenCalledWith({
      markers: [{ kind: 'credits', startMs: 80_000, endMs: null }],
      chapters: [],
    });
  });

  it('adds a chapter at the current time and keeps the list sorted', () => {
    setup({ initial: { markers: [], chapters: [{ startMs: 0, title: 'Welcome' }, { startMs: 200_000, title: 'End' }] } });
    fireEvent.click(screen.getByRole('button', { name: 'Add chapter at current time' }));
    const times = screen.getAllByRole('textbox', { name: /Chapter \d+ time/ }) as HTMLInputElement[];
    expect(times.map((t) => t.value)).toEqual(['0:00', '2:14', '3:20']);
  });

  it('refuses a first chapter that is not at zero', () => {
    setup({ initial: { markers: [], chapters: [{ startMs: 5_000, title: 'Late' }] } });
    expect(screen.getByText(/First chapter must start at 0:00/)).toBeTruthy();
  });

  it('shows the empty chapter list message', () => {
    setup();
    expect(screen.getByText('No chapters yet. Add one at the current time.')).toBeTruthy();
  });

  it('parses a pasted list, shows line errors and blocks adding until fixed', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Paste a list' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: '0:00 Welcome\n1:99 Bad\n2:00 Next' },
    });
    expect(within(dialog).getByText(/Line 2: 1:99 is not a valid time/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Fix line 2 to continue' })).toBeTruthy();
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: '0:00 Welcome\n1:45 Fixed\n2:00 Next' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add chapters' }));
    const titles = screen.getAllByRole('textbox', { name: /Chapter \d+ title/ }) as HTMLInputElement[];
    expect(titles.map((t) => t.value)).toEqual(['Welcome', 'Fixed', 'Next']);
  });

  it('copies markers from another episode of the same series for review', () => {
    setup({
      siblings: [
        {
          id: 'v2',
          title: 'How Clouds Form',
          label: 'S1 E2',
          markers: [{ kind: 'intro', startMs: 12_000, endMs: 48_000 }],
        },
      ],
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Copy from another episode' }), {
      target: { value: 'v2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy markers' }));
    expect((field('Intro start') as HTMLInputElement).value).toBe('0:12');
    expect((field('Intro end') as HTMLInputElement).value).toBe('0:48');
    expect(screen.getByText(/Copied intro from S1 E2 How Clouds Form\. Review the times, then save\./)).toBeTruthy();
  });

  it('hides the copy control for a standalone video', () => {
    setup();
    expect(screen.queryByRole('combobox', { name: 'Copy from another episode' })).toBeNull();
  });

  it('Test seeks to 3 seconds before the window', () => {
    setup({ initial: { markers: [{ kind: 'intro', startMs: 12_000, endMs: 48_000 }], chapters: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Test intro' }));
    expect(handle.seeks).toEqual([9]);
  });

  it('Clear empties a marker', () => {
    setup({ initial: { markers: [{ kind: 'intro', startMs: 12_000, endMs: 48_000 }], chapters: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear intro' }));
    expect((field('Intro start') as HTMLInputElement).value).toBe('');
  });

  it('asks before leaving with unsaved changes, and not when clean', () => {
    setup();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(field('Credits start'), { target: { value: '5:10' } });
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    expect(screen.getByText('You have unsaved changes.')).toBeTruthy();
  });

  it('keeps the typed times and shows an error when saving fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    setup({ save });
    fireEvent.change(field('Credits start'), { target: { value: '5:10' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
    expect(screen.getByText(/Could not save/)).toBeTruthy();
    expect((field('Credits start') as HTMLInputElement).value).toBe('5:10');
  });

  it('shows server field errors and a success message after saving', async () => {
    const save = vi.fn().mockResolvedValueOnce({ ok: false, errors: { intro: 'Intro runs past the end.' } });
    setup({ save });
    fireEvent.change(field('Credits start'), { target: { value: '5:10' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
    expect(screen.getByText('Intro runs past the end.')).toBeTruthy();
    save.mockResolvedValueOnce({ ok: true });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
    expect(screen.getByText('Saved. Viewers see this now.')).toBeTruthy();
  });
});
