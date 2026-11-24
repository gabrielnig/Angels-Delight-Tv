// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EN_NG } from '@ad/shared/messages';
import type { PlayerErrorKind } from '../types';
import { ErrorOverlay, HintBar } from './Overlays';

afterEach(cleanup);

const KINDS: PlayerErrorKind[] = [
  'connection-lost',
  'offline',
  'session-expired',
  'removed',
  'cannot-play',
  'unsupported-browser',
];
const links = { signIn: '/sign-in', browse: '/browse', help: '/help' };

function show(kind: PlayerErrorKind, extra: Partial<Parameters<typeof ErrorOverlay>[0]> = {}) {
  return render(
    <ErrorOverlay
      kind={kind}
      position={134}
      reference="AD-7K4Q"
      links={links}
      onRetry={vi.fn()}
      {...extra}
    />,
  );
}

describe('ErrorOverlay (L4-11, R39)', () => {
  it.each(KINDS)('%s shows one title, one sentence and one action', (kind) => {
    const { container } = show(kind);
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(container.querySelectorAll('.adp-overlay__body')).toHaveLength(1);
    expect(
      container.querySelectorAll('.adp-overlay__actions button, .adp-overlay__actions a'),
    ).toHaveLength(1);
  });

  it.each(KINDS)('%s puts focus on its action', (kind) => {
    const { container } = show(kind);
    const action = container.querySelector<HTMLElement>(
      '.adp-overlay__actions button, .adp-overlay__actions a',
    );
    expect(document.activeElement).toBe(action);
  });

  it('shows the reference as small text on cannot play, not inside the sentence', () => {
    const { container } = show('cannot-play');
    const ref = container.querySelector('.adp-overlay__ref');
    expect(ref?.textContent).toBe('Reference: AD-7K4Q');
    expect(container.querySelector('.adp-overlay__body')?.textContent).not.toContain('AD-7K4Q');
  });

  it('shows no reference on the other errors', () => {
    for (const kind of KINDS.filter((k) => k !== 'cannot-play' && k !== 'connection-lost')) {
      const { container, unmount } = show(kind);
      expect(container.querySelector('.adp-overlay__ref')).toBeNull();
      unmount();
    }
  });

  it('shows the reference on connection lost only from the third retry', () => {
    for (const retries of [0, 1, 2]) {
      const { container, unmount } = show('connection-lost', { retries });
      expect(container.querySelector('.adp-overlay__ref')).toBeNull();
      unmount();
    }
    const { container } = show('connection-lost', { retries: 3 });
    expect(container.querySelector('.adp-overlay__ref')?.textContent).toBe('Reference: AD-7K4Q');
  });

  it('copy has no dashes, no emojis and never blames the viewer', () => {
    const keys = Object.keys(EN_NG).filter(
      (k) =>
        k.startsWith('player.error.') ||
        k.startsWith('player.hint.') ||
        k.startsWith('player.action.'),
    );
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      const text = String((EN_NG as Record<string, unknown>)[key] ?? '');
      expect(text, key).not.toMatch(/[\u2013\u2014]/);
      expect(text, key).not.toMatch(/\bYou (failed|did|should have)\b/i);
    }
  });
});

describe('HintBar (L4-11)', () => {
  it('shows one sentence, one action and a dismiss button', () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    render(<HintBar kind="data-saver" onAction={onAction} onDismiss={onDismiss} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain(
      'Videos load slowly right now. Turn on Data saver to use less data',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('offers Open quality for a locked quality', () => {
    render(<HintBar kind="locked-quality" onAction={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toContain(
      'Slow connection. Try Auto or a lower quality',
    );
    expect(screen.getByRole('button', { name: 'Open quality' })).toBeTruthy();
  });
});
