// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DETAILS, type FileOverride, type UploadDetails } from '@/lib/uploader/upload-details';
import { UploadOverrides, type OverrideRow } from './UploadOverrides';

const categories = [
  { id: 'c1', name: 'Science' },
  { id: 'c2', name: 'Maths' },
];
const series = [{ id: 's1', title: 'Series X' }];
const shared: UploadDetails = { ...EMPTY_DETAILS, categoryIds: ['c1'], suitability: 'everyone' };

const row = (id: string, over: Partial<OverrideRow> = {}): OverrideRow => ({
  id,
  name: `${id}_clip-one.mp4`,
  size: 5_242_880,
  locked: false,
  override: {},
  ...over,
});

function setup(rows: OverrideRow[], details: UploadDetails = shared) {
  const onChange = vi.fn((_id: string, _patch: FileOverride) => undefined);
  const onReset = vi.fn();
  const view = render(
    <UploadOverrides
      rows={rows}
      shared={details}
      categories={categories}
      series={series}
      onChange={onChange}
      onReset={onReset}
    />,
  );
  return { onChange, onReset, view };
}

describe('UploadOverrides', () => {
  it('title defaults from the file name cleaned the way a new draft is named', () => {
    setup([row('a')]);
    expect(screen.getAllByLabelText('Title for a_clip-one.mp4')[0]).toHaveAttribute('placeholder', 'a clip one');
  });

  it('shows a Custom badge only on cells that differ, and Reset clears them', async () => {
    const { onReset } = setup([row('a', { override: { suitability: 'kids' } }), row('b')]);
    const first = screen.getAllByRole('row')[1]!;
    expect(within(first).getAllByText('Custom')).toHaveLength(1);
    expect(within(screen.getAllByRole('row')[2]!).queryByText('Custom')).toBeNull();
    await userEvent.click(within(first).getByRole('button', { name: 'Reset a_clip-one.mp4' }));
    expect(onReset).toHaveBeenCalledWith('a');
  });

  it('an override survives a change to the shared form', () => {
    const { view } = setup([row('a', { override: { suitability: 'kids' } })]);
    view.rerender(
      <UploadOverrides
        rows={[row('a', { override: { suitability: 'kids' } })]}
        shared={{ ...shared, suitability: 'older' }}
        categories={categories}
        series={series}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getAllByLabelText('Suitability for a_clip-one.mp4')[0]!).toHaveValue('kids');
  });

  it('a cell with no override follows the shared form', () => {
    setup([row('a')]);
    expect(screen.getAllByLabelText('Suitability for a_clip-one.mp4')[0]!).toHaveValue('');
    expect(screen.getAllByText('Same as all files').length).toBeGreaterThan(0);
  });

  it('editing a cell reports the override', async () => {
    const { onChange } = setup([row('a')]);
    await userEvent.selectOptions(screen.getAllByLabelText('Suitability for a_clip-one.mp4')[0]!, 'kids');
    expect(onChange).toHaveBeenCalledWith('a', { suitability: 'kids' });
    await userEvent.type(screen.getAllByLabelText('Title for a_clip-one.mp4')[0]!, 'X');
    expect(onChange).toHaveBeenLastCalledWith('a', { title: 'X' });
  });

  it('cells become read only after registration', () => {
    setup([row('a', { locked: true })]);
    expect(screen.getAllByLabelText('Title for a_clip-one.mp4')[0]).toBeDisabled();
    expect(screen.getAllByLabelText('Suitability for a_clip-one.mp4')[0]!).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Reset a_clip-one.mp4' })).toBeNull();
  });

  it('header and size cells follow the alignment rule and cards exist for phones', () => {
    setup([row('a')]);
    expect(screen.getByRole('columnheader', { name: 'Size' })).toHaveClass('adm-num');
    expect(document.querySelector('td.adm-num')).not.toBeNull();
    expect(document.querySelector('ul.adm-cards')).not.toBeNull();
  });

  it('every cell is a labelled control the keyboard can reach', () => {
    setup([row('a')]);
    for (const label of ['Title', 'Category', 'Series', 'Number', 'Suitability'])
      expect(screen.getAllByLabelText(`${label} for a_clip-one.mp4`)[0]!).toBeInTheDocument();
  });
});
