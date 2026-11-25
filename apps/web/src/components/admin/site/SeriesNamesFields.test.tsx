// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { SeriesLabelSetting } from '@ad/shared/series-labels';
import { SeriesNamesFields } from './SeriesNamesFields';

function Harness({
  start,
  errors = {},
}: {
  start: SeriesLabelSetting;
  errors?: Record<string, string>;
}) {
  const [value, setValue] = useState(start);
  return (
    <>
      <SeriesNamesFields value={value} onChange={setValue} errors={errors} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

describe('SeriesNamesFields (M51-S01)', () => {
  it('lists the five name sets and previews the default words', () => {
    render(<Harness start={{ preset: 'season_episode' }} />);
    const select = screen.getByRole('combobox', { name: 'Name set' });
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Season and Episode',
      'Book and Chapter',
      'Part and Lesson',
      'Module and Lesson',
      'Custom names',
    ]);
    expect(screen.getByText('Season 1, Episode 4')).toBeInTheDocument();
    expect(screen.getByText('S1 E4')).toBeInTheDocument();
    expect(screen.getByText('Next: E4')).toBeInTheDocument();
  });

  it('switching to Book and Chapter updates the preview and hides the word fields', async () => {
    const user = userEvent.setup();
    render(<Harness start={{ preset: 'season_episode' }} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Name set' }), 'book_chapter');
    expect(screen.getByText('Book 1, Chapter 4')).toBeInTheDocument();
    expect(screen.getByText('Next: Ch4')).toBeInTheDocument();
    expect(screen.queryByLabelText('Group, singular')).not.toBeInTheDocument();
  });

  it('custom shows four word fields and a code field with a live preview', async () => {
    const user = userEvent.setup();
    render(<Harness start={{ preset: 'season_episode' }} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Name set' }), 'custom');
    await user.type(screen.getByLabelText('Group, singular'), 'Volume');
    await user.type(screen.getByLabelText('Group, plural'), 'Volumes');
    await user.type(screen.getByLabelText('Item, singular'), 'Study');
    await user.type(screen.getByLabelText('Item, plural'), 'Studies');
    await user.type(screen.getByLabelText('Item code'), 'St');
    expect(screen.getByText('Volume 1, Study 4')).toBeInTheDocument();
    expect(screen.getByText('V1 St4')).toBeInTheDocument();
  });

  it('shows the error under the field it belongs to', () => {
    render(
      <Harness
        start={{
          preset: 'custom',
          custom: { group: { one: '', other: '' }, item: { one: '', other: '' } },
        }}
        errors={{ 'custom.group.one': 'Enter this word' }}
      />,
    );
    expect(screen.getByText('Enter this word')).toBeInTheDocument();
  });
});
