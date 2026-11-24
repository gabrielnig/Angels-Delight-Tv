// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptionReview } from './CaptionReview';
import { ToastProvider } from './Toast';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const video = { id: 'v1', title: 'Lesson one', durationSeconds: 60 } as never;
const track = {
  state: 'ready',
  cues: [
    { id: 'a', start: 0, end: 2000, text: 'Hello there' },
    { id: 'b', start: 2000, end: 4000, text: 'Second line' },
  ],
  updatedAt: 1,
} as never;
const ok = { ok: true, changesSinceApproval: 0 };
const actions = () => ({
  save: vi.fn().mockResolvedValue(ok),
  approve: vi.fn().mockResolvedValue({ ok: true }),
  regenerate: vi.fn().mockResolvedValue({ ok: true }),
  upload: vi.fn().mockResolvedValue({ ok: true }),
});
afterEach(cleanup);

const view = (a = actions(), role: 'admin' | 'viewer' = 'admin') =>
  render(
    <ToastProvider>
      <CaptionReview video={video} track={track} role={role} actions={a} />
    </ToastProvider>,
  );

describe('CaptionReview', () => {
  it('lists cues and marks the one at the playhead', () => {
    view();
    expect(screen.getByLabelText('Words in cue 1')).toHaveProperty('value', 'Hello there');
    expect(document.querySelector('[aria-current="true"]')).not.toBeNull();
  });
  it('enables undo after an edit', () => {
    view();
    const undoBtn = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Words in cue 1'), { target: { value: 'Hi' } });
    expect(undoBtn.disabled).toBe(false);
  });
  it('shows an overlap warning for bad timing', () => {
    view();
    const end = screen.getByLabelText('End of cue 1');
    fireEvent.change(end, { target: { value: '00:03.000' } });
    fireEvent.blur(end);
    expect(screen.getAllByText(/overlap/i).length).toBeGreaterThan(0);
  });
  it('is read only without edit rights', () => {
    view(actions(), 'viewer');
    expect((screen.getByLabelText('Words in cue 1') as HTMLTextAreaElement).readOnly).toBe(true);
  });
});

describe('CaptionReview low confidence cues', () => {
  const flaggedTrack = {
    state: 'needs_review',
    cues: [
      { id: 'a', start: 0, end: 2000, text: 'Hello there' },
      { id: 'b', start: 2000, end: 4000, text: 'Second line', lowConfidence: true },
      { id: 'c', start: 4000, end: 6000, text: 'Third line', lowConfidence: true },
    ],
    updatedAt: 1,
  } as never;

  const flagged = (a = actions()) =>
    render(
      <ToastProvider>
        <CaptionReview video={video} track={flaggedTrack} role="admin" actions={a} />
      </ToastProvider>,
    );

  it('says how many cues need a check and marks each one with words', () => {
    flagged();
    expect(screen.getByText(/2 cues to check/i)).toBeInTheDocument();
    expect(screen.getAllByText('Check this cue')).toHaveLength(2);
    expect(document.querySelectorAll('.adm-cue--check')).toHaveLength(2);
  });

  it('clears the mark when the words of a cue are edited', () => {
    flagged();
    fireEvent.change(screen.getByLabelText('Words in cue 2'), { target: { value: 'Second line fixed' } });
    expect(screen.getAllByText('Check this cue')).toHaveLength(1);
    expect(screen.getByText(/1 cue to check/i)).toBeInTheDocument();
  });

  it('can show only the cues to check', () => {
    flagged();
    fireEvent.click(screen.getByLabelText('Show only cues to check'));
    expect(screen.queryByLabelText('Words in cue 1')).toBeNull();
    expect(screen.getByLabelText('Words in cue 2')).toBeInTheDocument();
  });

  it('shows nothing extra when no cue is flagged', () => {
    view();
    expect(screen.queryByText(/to check/i)).toBeNull();
  });
});

describe('CaptionReview script alignment', () => {
  it('previews the cleaned script and sends it for alignment', async () => {
    const a = {
      ...actions(),
      previewScript: vi.fn().mockResolvedValue('Hello there'),
      alignScript: vi.fn().mockResolvedValue({ ok: true }),
    };
    view(a as never);
    fireEvent.click(screen.getByRole('button', { name: 'Align a script' }));
    fireEvent.change(screen.getByLabelText('Script'), { target: { value: 'NARRATOR: Hello there' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('Hello there', { selector: 'pre' })).toBeInTheDocument();
    expect(a.previewScript).toHaveBeenCalledWith('NARRATOR: Hello there');
    fireEvent.click(screen.getByRole('button', { name: 'Align to audio' }));
    await vi.waitFor(() => expect(a.alignScript).toHaveBeenCalledWith('NARRATOR: Hello there'));
  });

  it('shows the plain reason when alignment is refused', async () => {
    const a = {
      ...actions(),
      previewScript: vi.fn(),
      alignScript: vi.fn().mockResolvedValue({ ok: false, error: 'Paste the script text first.' }),
    };
    view(a as never);
    fireEvent.click(screen.getByRole('button', { name: 'Align a script' }));
    fireEvent.click(screen.getByRole('button', { name: 'Align to audio' }));
    expect(await screen.findByText('Paste the script text first.')).toBeInTheDocument();
  });

  it('offers no script tools without the right to edit or without script support', () => {
    view(actions(), 'viewer');
    expect(screen.queryByRole('button', { name: 'Align a script' })).toBeNull();
    view();
    expect(screen.queryByRole('button', { name: 'Align a script' })).toBeNull();
  });
});

describe('CaptionReview translation mode (M46-S15)', () => {
  const translated = {
    state: 'needs_review',
    language: 'yo',
    cues: [
      { id: 'a', start: 0, end: 2000, text: 'Kaabo' },
      { id: 'b', start: 2000, end: 4000, text: 'Ila keji' },
    ],
    updatedAt: 2,
    translation: {
      spokenLanguage: 'en',
      sourceCues: [
        { id: 's1', start: 0, end: 2000, text: 'Hello there' },
        { id: 's2', start: 2000, end: 4000, text: 'Second line' },
      ],
      published: false,
      sourceChanged: false,
    },
  } as never;
  const mount = (a = actions(), t = translated) =>
    render(
      <ToastProvider>
        <CaptionReview video={video} track={t} role="admin" actions={a} />
      </ToastProvider>,
    );

  it('shows the spoken language cue beside each translated cue', () => {
    mount();
    expect(screen.getByLabelText('English cue 1').textContent).toBe('Hello there');
    expect(screen.getByLabelText('English cue 2').textContent).toBe('Second line');
    expect(screen.getByLabelText('English cue 1').getAttribute('lang')).toBe('en');
    expect(screen.getByLabelText('Words in cue 1').getAttribute('lang')).toBe('yo');
  });

  it('time fields are locked until Unlock timing, which warns', () => {
    mount();
    expect((screen.getByLabelText('Start of cue 1') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Split cue 1/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock timing' }));
    expect((screen.getByLabelText('Start of cue 1') as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByText(/Changing times can put the words out of step/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lock timing' })).toBeTruthy();
  });

  it('the spoken language screen has no source column and no lock', () => {
    view();
    expect(screen.queryByLabelText('English cue 1')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unlock timing' })).toBeNull();
  });

  it('approve says viewers will not see it until it is published', async () => {
    const a = actions();
    mount(a);
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    expect(await screen.findByText(/Viewers will not see it until an admin publishes this language/)).toBeTruthy();
  });

  it('Source changed shows a banner with a Retranslate action', async () => {
    const a = { ...actions(), retranslate: vi.fn().mockResolvedValue({ ok: true }) };
    const t = { ...(translated as object), translation: { ...(translated as never as { translation: object }).translation, sourceChanged: true } } as never;
    mount(a, t);
    expect(screen.getByText(/The source captions changed after this translation was made/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retranslate' }));
    expect(a.retranslate).toHaveBeenCalled();
  });
});
