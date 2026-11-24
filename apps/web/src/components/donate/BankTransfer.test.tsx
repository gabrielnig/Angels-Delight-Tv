// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BankTransfer } from './BankTransfer';

afterEach(cleanup);

describe('BankTransfer', () => {
  it('shows the owner text as plain text with its line breaks, never as markup', () => {
    const { container } = render(<BankTransfer instructions={'Bank: <b>Example</b>\nAccount: 0123456789'} />);
    expect(screen.getByRole('heading', { name: /bank transfer/i })).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText(/Bank: <b>Example<\/b>/)).toBeInTheDocument();
    expect(screen.getByText(/Account: 0123456789/)).toBeInTheDocument();
  });
  it('renders nothing for an empty or blank text', () => {
    const { container } = render(<BankTransfer instructions={'   '} />);
    expect(container).toBeEmptyDOMElement();
  });
});
