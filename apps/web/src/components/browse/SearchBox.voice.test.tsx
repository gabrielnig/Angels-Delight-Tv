// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileKidsProvider } from '../../lib/profile-context';
import { VOICE_OK_KEY } from './voice';
import { SearchBox } from './SearchBox';

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = '';
  interimResults = false;
  continuous = false;
  maxAlternatives = 1;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    FakeRecognition.last = this;
  }
  say(text: string, final: boolean) {
    this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: final })] });
  }
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(VOICE_OK_KEY, '1');
  (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
});
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  vi.useRealTimers();
});

const box = (onSearch = vi.fn()) => (
  <SearchBox onSearch={onSearch} onNavigate={vi.fn()} loadSuggestions={vi.fn().mockResolvedValue([])} />
);

describe('voice in the search box (M45-S10)', () => {
  it('shows the microphone beside the field when the browser can listen', async () => {
    render(box());
    expect(await screen.findByRole('button', { name: 'Search by voice' })).toBeInTheDocument();
  });

  it('shows nothing in a browser without speech recognition', async () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    render(box());
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Search by voice' })).toBeNull();
  });

  it('hides the microphone on a Kids profile', async () => {
    render(<ProfileKidsProvider kids>{box()}</ProfileKidsProvider>);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Search by voice' })).toBeNull();
  });

  it('hides the microphone under Data saver', async () => {
    window.localStorage.setItem('ad.datasaver.guest', 'on');
    render(box());
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Search by voice' })).toBeNull();
  });

  it('fills the box with interim words and searches 600 ms after the last final result', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSearch = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(box(onSearch));
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    act(() => FakeRecognition.last!.say('how to save mon', false));
    expect(screen.getByRole('combobox')).toHaveValue('how to save mon');
    act(() => FakeRecognition.last!.say('how to save money', true));
    expect(screen.getByRole('combobox')).toHaveValue('how to save money');
    await act(async () => {
      vi.advanceTimersByTime(599);
    });
    expect(onSearch).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(2);
    });
    expect(onSearch).toHaveBeenCalledWith('how to save money');
  });

  it('does not search if the viewer types again before the delay ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSearch = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(box(onSearch));
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    act(() => FakeRecognition.last!.say('farm', true));
    await user.type(screen.getByRole('combobox'), 's');
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSearch).not.toHaveBeenCalled();
  });
});
