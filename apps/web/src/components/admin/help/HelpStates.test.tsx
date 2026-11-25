// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpConnectionNote, HelpErrorView, HelpLoading, HelpNotFoundView } from './HelpStates';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
});
const offline = () =>
  Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });

describe('HelpErrorView (S198 server error and offline, guide not loaded)', () => {
  it('moves focus to the heading, speaks as an alert, and gives one action and a reference', async () => {
    const reset = vi.fn();
    render(<HelpErrorView digest="4f2a99" reset={reset} />);
    const heading = screen.getByRole('heading', { name: 'We could not load this guide' });
    expect(document.activeElement).toBe(heading);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on our side. Try again in a moment.');
    expect(alert).toHaveTextContent('Reference: AD-4F2A');
    expect(within(alert).getAllByRole('button')).toHaveLength(1);
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalled();
  });

  it('omits the reference when there is no digest', () => {
    render(<HelpErrorView reset={() => {}} />);
    expect(screen.queryByText(/Reference:/)).toBeNull();
  });

  it('says honestly that the guide is not on this device when offline', () => {
    offline();
    render(<HelpErrorView reset={() => {}} />);
    expect(screen.getByRole('heading', { name: 'You are offline' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This guide has not loaded on this device. Connect and try again.',
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('HelpNotFoundView', () => {
  it('has one action back to the help centre', () => {
    render(<HelpNotFoundView />);
    expect(
      screen.getByRole('heading', { name: 'We could not find that guide' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('It may have moved. Go back to the Help centre and search for it.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Help centre' })).toHaveAttribute(
      'href',
      '/admin/help',
    );
  });
});

describe('HelpConnectionNote', () => {
  it('appears only while offline and says progress will save later', () => {
    const { container } = render(<HelpConnectionNote />);
    expect(container).toBeEmptyDOMElement();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent('You are offline. Check your data or Wi-Fi.');
    expect(note).toHaveTextContent('Progress will save when you are back online.');
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('HelpLoading', () => {
  it('shows a skeleton after 300 ms and a slow note after 6 s with no spinner', async () => {
    vi.useFakeTimers();
    render(<HelpLoading />);
    expect(screen.queryByRole('status', { name: 'Loading guide' })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByRole('status', { name: 'Loading guide' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.queryByText(/Still loading/)).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(
      screen.getByText(
        'Still loading. Your connection may be slow. The video waits until you press Play.',
      ),
    ).toBeInTheDocument();
    expect(document.querySelector('.adm-spinner')).toBeNull();
  });
});
