// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyOutcome, type BulkOutcome } from '@/lib/data/admin/bulk';
import { BulkReport, reportText } from './BulkReport';

afterEach(cleanup);

const titles: Record<string, string> = { a: 'Rain', b: 'Sun', c: 'Wind', d: 'Snow' };
const label = (id: string) => titles[id] ?? id;

const partial: BulkOutcome = {
  ...emptyOutcome('b1'),
  succeeded: ['a'],
  failed: [
    { id: 'b', reason: 'Timed out.', retryable: true },
    { id: 'c', reason: 'Not ready: Captions needs attention first.' },
  ],
  skipped: [{ id: 'd', reason: 'Already published.' }],
};

describe('BulkReport', () => {
  it('all succeeded shows no panel (the caller shows a toast with Undo)', () => {
    const { container } = render(
      <BulkReport label="Publish" outcome={{ ...emptyOutcome('b'), succeeded: ['a'] }} itemLabel={label} onDismiss={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('partial failure lists each reason', () => {
    render(<BulkReport label="Publish" outcome={partial} itemLabel={label} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Publish: 1 done, 2 could not be changed, 1 skipped.');
    expect(screen.getByText('Timed out.')).toBeInTheDocument();
    expect(screen.getByText('Not ready: Captions needs attention first.')).toBeInTheDocument();
    expect(screen.getByText('Already published.')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Wind')).toBeInTheDocument();
    expect(screen.queryByText('Rain')).toBeNull();
  });

  it('Retry offers only retryable failures', () => {
    const onRetry = vi.fn();
    render(<BulkReport label="Publish" outcome={partial} itemLabel={label} onDismiss={() => {}} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry the 1 that failed' }));
    expect(onRetry).toHaveBeenCalledWith(['b']);
  });

  it('no Retry button when nothing is retryable', () => {
    const outcome: BulkOutcome = { ...partial, failed: [{ id: 'c', reason: 'Not ready.' }] };
    render(<BulkReport label="Publish" outcome={outcome} itemLabel={label} onDismiss={() => {}} onRetry={() => {}} />);
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
  });

  it('Copy list copies titles and reasons', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<BulkReport label="Publish" outcome={partial} itemLabel={label} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy list' }));
    expect(writeText).toHaveBeenCalledWith(reportText(partial, label));
    expect(reportText(partial, label)).toContain('Sun: Timed out.');
    expect(reportText(partial, label)).toContain('Snow: Already published.');
  });

  it('nothing succeeded uses the danger tone and offers no Undo', () => {
    const outcome: BulkOutcome = { ...emptyOutcome('b'), failed: [{ id: 'b', reason: 'Timed out.', retryable: true }] };
    render(<BulkReport label="Publish" outcome={outcome} itemLabel={label} onDismiss={() => {}} onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull();
  });

  it('a run that only skipped items is a warning, not an error', () => {
    const outcome: BulkOutcome = { ...emptyOutcome('b'), skipped: [{ id: 'd', reason: 'Not ready. Replace the file instead.' }] };
    render(<BulkReport label="Retry" outcome={outcome} itemLabel={label} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('interrupted run offers Continue', () => {
    const onContinue = vi.fn();
    const outcome: BulkOutcome = { ...emptyOutcome('b'), succeeded: ['a'], interrupted: { done: 50, total: 120 } };
    render(<BulkReport label="Publish" outcome={outcome} itemLabel={label} onDismiss={() => {}} onContinue={onContinue} />);
    expect(screen.getByText(/Done 50 of 120 before the connection dropped/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalled();
  });

  it('moves focus to the heading and Dismiss closes the panel', () => {
    const onDismiss = vi.fn();
    render(<BulkReport label="Publish" outcome={partial} itemLabel={label} onDismiss={onDismiss} />);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: /Publish: 1 done/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('report links are 44px high rows', () => {
    render(<BulkReport label="Publish" outcome={partial} itemLabel={label} itemHref={(id) => `/admin/videos/${id}`} onDismiss={() => {}} />);
    expect(screen.getByRole('link', { name: 'Sun' })).toHaveAttribute('href', '/admin/videos/b');
    expect(screen.getByRole('link', { name: 'Sun' }).closest('li')).toHaveClass('adm-bulk-report__item');
  });
});
