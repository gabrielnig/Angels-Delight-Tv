// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lane } from '@/lib/uploader/types';

const lanes: Lane[] = [];
let nextId = 0;
const uploader = {
  add: vi.fn((file: File) => {
    const lane = {
      id: `lane${nextId++}`,
      name: file.name,
      size: file.size,
      type: file.type,
      fingerprint: file.name,
      status: 'waiting',
      bytesUploaded: 0,
      percent: 0,
      speedBytesPerSecond: 0,
      etaSeconds: null,
      attempt: 0,
    } as Lane;
    lanes.push(lane);
    return lane;
  }),
  pause: vi.fn(),
  resume: vi.fn(),
  retry: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  setFileConcurrency: vi.fn(),
};
vi.mock('./UploaderContext', () => ({
  useUploaderState: () => ({ uploader, lanes: [...lanes], online: true }),
}));
vi.mock('next/link', () => ({ default: ({ children, ...p }: { children: React.ReactNode }) => <a {...p}>{children}</a> }));

const { UploadScreen } = await import('./UploadScreen');

const categories = [
  { id: 'c1', name: 'Science' },
  { id: 'c2', name: 'Maths' },
];
const series = [{ id: 's1', title: 'Series X' }];

beforeEach(() => {
  lanes.length = 0;
  nextId = 0;
  vi.clearAllMocks();
});

function setup(props: Partial<Parameters<typeof UploadScreen>[0]> = {}) {
  const applyDetails = vi.fn(async () => ({ ok: true as const }));
  const registerUpload = vi.fn(async () => ({ id: 'vid1' }));
  const ui = () => (
    <UploadScreen
      categories={categories}
      series={series}
      applyDetails={applyDetails}
      registerUpload={registerUpload}
      {...props}
    />
  );
  const view = render(ui());
  return { applyDetails, registerUpload, view, rerender: () => view.rerender(ui()) };
}
const file = (name: string) => new File(['x'], name, { type: 'video/mp4' });
const addFiles = (...names: string[]) =>
  userEvent.upload(screen.getByTestId('file-input'), names.map(file));

describe('UploadScreen shared details', () => {
  it('shows the form before files are added and a one line summary after', async () => {
    setup();
    const form = screen.getByRole('group', { name: 'Details for every file' });
    await userEvent.click(within(form).getByRole('checkbox', { name: 'Science' }));
    await userEvent.selectOptions(within(form).getByLabelText('Suitability'), 'everyone');
    await addFiles('a.mp4', 'b.mp4');
    expect(screen.queryByRole('group', { name: 'Details for every file' })).toBeNull();
    expect(screen.getByText('Details for all 2 files: Science, Everyone.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    expect(screen.getByRole('group', { name: 'Details for every file' })).toBeInTheDocument();
  });

  it('files added after a change use the new details and episodes follow file order', async () => {
    const { applyDetails, rerender } = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Science' }));
    await userEvent.selectOptions(screen.getByLabelText('Series'), 's1');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Number episodes in file order' }));
    await addFiles('a.mp4', 'b.mp4');
    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Maths' }));
    await addFiles('c.mp4');
    lanes.forEach((l, i) => Object.assign(l, { videoId: `v${i}`, status: 'done' }));
    rerender();
    await waitFor(() => expect(applyDetails).toHaveBeenCalledTimes(3));
    expect(applyDetails).toHaveBeenNthCalledWith(1, 'v0', expect.objectContaining({ categoryIds: ['c1'], seriesId: 's1', episodeNumber: 1 }));
    expect(applyDetails).toHaveBeenNthCalledWith(2, 'v1', expect.objectContaining({ categoryIds: ['c1'], episodeNumber: 2 }));
    expect(applyDetails).toHaveBeenNthCalledWith(3, 'v2', expect.objectContaining({ categoryIds: ['c1', 'c2'], episodeNumber: 3 }));
  });

  it('does not call apply when no detail was set', async () => {
    const { applyDetails, rerender } = setup();
    await addFiles('a.mp4');
    lanes.forEach((l) => Object.assign(l, { videoId: 'v0', status: 'done' }));
    rerender();
    expect(applyDetails).not.toHaveBeenCalled();
  });

  it('replace mode hides the form', () => {
    setup({ replace: { videoId: 'v1', title: 'Old' } });
    expect(screen.queryByRole('group', { name: 'Details for every file' })).toBeNull();
  });
});
