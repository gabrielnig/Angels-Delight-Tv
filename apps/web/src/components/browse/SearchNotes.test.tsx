// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SearchNotes } from './SearchNotes';

describe('SearchNotes (M45-S07, S08)', () => {
  it('says what the results are for, politely, with a link to the typed words', () => {
    render(<SearchNotes query="budgetng" showingFor="budgeting" subjects={[]} didYouMean={null} />);
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent('Showing results for budgeting');
    expect(screen.getByRole('link', { name: 'budgetng' })).toHaveAttribute(
      'href',
      '/search?q=budgetng&exact=1',
    );
  });

  it('offers a did you mean link as a link', () => {
    render(<SearchNotes query="financ" showingFor={null} subjects={[]} didYouMean="finance" />);
    expect(screen.getByRole('link', { name: 'finance' })).toHaveAttribute('href', '/search?q=finance');
    expect(screen.getByText(/Did you mean/)).toBeInTheDocument();
  });

  it('shows a Subjects row of category links above the results', () => {
    render(
      <SearchNotes
        query="money"
        showingFor={null}
        didYouMean={null}
        subjects={[{ slug: 'money-skills', name: 'Money skills' }]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Subjects' });
    expect(nav).toContainElement(screen.getByRole('link', { name: 'Money skills' }));
    expect(screen.getByRole('link', { name: 'Money skills' })).toHaveAttribute('href', '/browse/money-skills');
  });

  it('renders nothing when there is nothing to say', () => {
    const { container } = render(<SearchNotes query="x" showingFor={null} didYouMean={null} subjects={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
