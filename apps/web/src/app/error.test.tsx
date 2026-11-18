// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const track = vi.fn();
vi.mock('../lib/analytics/browser', () => ({ getAnalyticsClient: () => ({ track }) }));
const { default: ErrorPage } = await import('./error');

describe('error page', () => {
  it('shows the reference so a viewer can quote it, and offers a retry', async () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('secret internals'), { digest: 'abc123' });
    render(<ErrorPage error={error} reset={reset} />);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('Reference: abc123')).toBeInTheDocument();
    expect(screen.queryByText(/secret internals/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    expect(track).toHaveBeenCalledWith({ kind: 'error', code: 'app.render' });
  });
});
