// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnstileWidget } from './TurnstileWidget';

interface Options {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}
let options: Options | undefined;
const turnstile = {
  render: vi.fn((_el: HTMLElement, o: Options) => {
    options = o;
    return 'widget-1';
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

beforeEach(() => {
  options = undefined;
  turnstile.render.mockClear();
  turnstile.reset.mockClear();
  turnstile.remove.mockClear();
  (window as unknown as { turnstile?: typeof turnstile }).turnstile = turnstile;
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { turnstile?: unknown }).turnstile;
  document.getElementById('cf-turnstile-api')?.remove();
});

describe('TurnstileWidget', () => {
  it('renders the widget with the site key and reports tokens', () => {
    const onToken = vi.fn();
    render(<TurnstileWidget siteKey="site-key" onToken={onToken} />);
    expect(turnstile.render).toHaveBeenCalledTimes(1);
    expect(options!.sitekey).toBe('site-key');
    options!.callback('abc');
    expect(onToken).toHaveBeenLastCalledWith('abc');
    options!['expired-callback']();
    expect(onToken).toHaveBeenLastCalledWith(null);
    options!['error-callback']();
    expect(onToken).toHaveBeenLastCalledWith(null);
  });

  it('says what it is doing until there is a token', () => {
    render(<TurnstileWidget siteKey="k" onToken={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Security check' })).toBeInTheDocument();
  });

  it('resets when asked to, because a token works once', () => {
    const onToken = vi.fn();
    const { rerender } = render(<TurnstileWidget siteKey="k" onToken={onToken} resetKey={0} />);
    rerender(<TurnstileWidget siteKey="k" onToken={onToken} resetKey={1} />);
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1');
    expect(onToken).toHaveBeenLastCalledWith(null);
  });

  it('loads the Cloudflare script once when it is not on the page yet', () => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    render(<TurnstileWidget siteKey="k" onToken={vi.fn()} />);
    render(<TurnstileWidget siteKey="k" onToken={vi.fn()} />);
    const scripts = document.querySelectorAll('#cf-turnstile-api');
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toContain(
      'https://challenges.cloudflare.com/turnstile/v0/api.js',
    );
  });

  it('removes the widget when it leaves the page', () => {
    const { unmount } = render(<TurnstileWidget siteKey="k" onToken={vi.fn()} />);
    unmount();
    expect(turnstile.remove).toHaveBeenCalledWith('widget-1');
  });
});
