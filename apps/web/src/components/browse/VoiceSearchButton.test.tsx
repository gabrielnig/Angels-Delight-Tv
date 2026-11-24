// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VOICE_OK_KEY } from './voice';
import { VoiceSearchButton } from './VoiceSearchButton';

class FakeRecognition {
  static last: FakeRecognition | null = null;
  static started: string[] = [];
  lang = '';
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => {
    FakeRecognition.started.push(this.lang);
  });
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());
  constructor() {
    FakeRecognition.last = this;
  }
  say(text: string, final: boolean) {
    this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: final })] });
  }
}

beforeEach(() => {
  window.localStorage.clear();
  FakeRecognition.last = null;
  FakeRecognition.started = [];
  (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
});
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
});

const setup = (onText = vi.fn()) => ({ onText, user: userEvent.setup(), ...render(<VoiceSearchButton onText={onText} />) });

describe('VoiceSearchButton (M45-S10, S134)', () => {
  it('is not rendered when the browser cannot listen', async () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    const { container } = setup();
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a labelled toggle that is not pressed and never starts by itself', async () => {
    setup();
    const button = await screen.findByRole('button', { name: 'Search by voice' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(FakeRecognition.last).toBeNull();
  });

  it('asks once on first use, and Continue remembers the answer and starts listening', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    const dialog = screen.getByRole('dialog', { name: 'Use your voice to search?' });
    expect(dialog).toHaveTextContent('Your browser may send what you say to its speech service. We do not store what you say.');
    expect(FakeRecognition.started).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(window.localStorage.getItem(VOICE_OK_KEY)).toBe('1');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(FakeRecognition.started).toEqual(['en-NG']);
    expect(screen.getByRole('button', { name: 'Stop listening' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Cancel closes the question, remembers nothing and does not listen', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(window.localStorage.getItem(VOICE_OK_KEY)).toBeNull();
    expect(FakeRecognition.last).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Search by voice' })).toHaveFocus();
  });

  it('Escape closes the question', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not ask again once the viewer said Continue', async () => {
    window.localStorage.setItem(VOICE_OK_KEY, '1');
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(FakeRecognition.started).toEqual(['en-NG']);
  });

  it('says it is listening in a polite status and passes interim then final words on', async () => {
    window.localStorage.setItem(VOICE_OK_KEY, '1');
    const { user, onText } = setup();
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    expect(screen.getByRole('status')).toHaveTextContent('Listening. Say a subject or a title. Press Escape to stop.');
    act(() => FakeRecognition.last!.say('how to save mon', false));
    expect(onText).toHaveBeenLastCalledWith('how to save mon', false);
    act(() => FakeRecognition.last!.say('how to save money', true));
    expect(onText).toHaveBeenLastCalledWith('how to save money', true);
  });

  it('returns to idle when recognition ends', async () => {
    window.localStorage.setItem(VOICE_OK_KEY, '1');
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    act(() => FakeRecognition.last!.onend?.());
    expect(screen.getByRole('button', { name: 'Search by voice' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('maps not allowed, no speech and network errors to plain messages and goes idle', async () => {
    window.localStorage.setItem(VOICE_OK_KEY, '1');
    const { user } = setup();
    const button = () => screen.getByRole('button', { name: /Search by voice|Stop listening/ });
    for (const [code, text] of [
      ['not-allowed', 'Microphone access is off'],
      ['no-speech', 'We did not hear anything'],
      ['network', 'Voice search needs a connection'],
    ] as const) {
      await user.click(button());
      act(() => FakeRecognition.last!.onerror?.({ error: code }));
      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(button()).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('falls back to US English once when Nigerian English is not supported', async () => {
    window.localStorage.setItem(VOICE_OK_KEY, '1');
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    act(() => FakeRecognition.last!.onerror?.({ error: 'language-not-supported' }));
    expect(FakeRecognition.started).toEqual(['en-NG', 'en-US']);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stops listening on Escape and when the button is pressed again', async () => {
    window.localStorage.setItem(VOICE_OK_KEY, '1');
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    const first = FakeRecognition.last!;
    await user.keyboard('{Escape}');
    expect(first.stop).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    await user.click(screen.getByRole('button', { name: 'Stop listening' }));
    expect(FakeRecognition.last!.stop).toHaveBeenCalled();
  });

  it('stops listening when it leaves the page', async () => {
    window.localStorage.setItem(VOICE_OK_KEY, '1');
    const { user, unmount } = setup();
    await user.click(await screen.findByRole('button', { name: 'Search by voice' }));
    const rec = FakeRecognition.last!;
    unmount();
    expect(rec.abort).toHaveBeenCalled();
  });

  it('marks the button 44 px and gives the pulse a still ring under reduced motion', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const css = readFileSync(resolve(__dirname, 'voice.css'), 'utf8');
    expect(css).toMatch(/\.web-voice[^}]*min-height:\s*44px/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*animation:\s*none/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/outline:\s*none/);
  });
});
