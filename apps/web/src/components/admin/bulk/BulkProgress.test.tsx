// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BulkProgress } from './BulkProgress';

afterEach(cleanup);

describe('BulkProgress', () => {
  it('is a progressbar with values and a number beside it', () => {
    render(<BulkProgress label="Publish" done={50} total={120} onCancel={() => {}} />);
    const bar = screen.getByRole('progressbar', { name: 'Publish' });
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '120');
    expect(screen.getByText('Done 50 of 120')).toBeInTheDocument();
  });

  it('Cancel stops after the current chunk', () => {
    const onCancel = vi.fn();
    render(<BulkProgress label="Publish" done={25} total={120} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByText(/after the current batch/i)).toBeInTheDocument();
  });

  it('says when it is waiting for the connection', () => {
    render(<BulkProgress label="Publish" done={25} total={120} offline onCancel={() => {}} />);
    expect(screen.getByText(/waiting for the connection/i)).toBeInTheDocument();
  });
});
