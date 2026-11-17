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
