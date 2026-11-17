import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pill, PillRow } from './Pill';

describe('Pill', () => {
  it('is a toggle button with aria-pressed', async () => {
    const onClick = vi.fn();
    render(
      <Pill pressed={false} onClick={onClick}>
        Health
      </Pill>,
    );
    const pill = screen.getByRole('button', { name: 'Health' });
    expect(pill).toHaveAttribute('aria-pressed', 'false');
    await userEvent.setup().click(pill);
    expect(onClick).toHaveBeenCalled();
  });

  it('shows a tick when active so colour is not the only signal', () => {
    const { container } = render(<Pill pressed>Money</Pill>);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders as a link with aria-current when it navigates', () => {
    render(
      <Pill href="/browse/health" current>
        Health
      </Pill>,
    );
    const link = screen.getByRole('link', { name: 'Health' });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('uses aria-selected when it is a tab', () => {
    render(
      <Pill role="tab" selected>
        Episodes
      </Pill>,
    );
    expect(screen.getByRole('tab', { name: 'Episodes' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('PillRow', () => {
  it('is a labelled group', () => {
    render(
      <PillRow label="Categories">
        <Pill>All</Pill>
      </PillRow>,
    );
    expect(screen.getByRole('group', { name: 'Categories' })).toBeInTheDocument();
  });
});
