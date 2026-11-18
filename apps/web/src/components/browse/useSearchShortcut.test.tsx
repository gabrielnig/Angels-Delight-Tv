// @vitest-environment jsdom
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useSearchShortcut } from './useSearchShortcut';

function Harness({ go, withBox }: { go: (href: string) => void; withBox?: boolean }) {
  useSearchShortcut(go);
  return (
    <div>
      {withBox ? <input type="search" aria-label="Search videos" /> : null}
      <input aria-label="Other" />
      <button>Plain</button>
    </div>
  );
}

describe('useSearchShortcut', () => {
  it('focuses the search box when / is pressed', async () => {
    const go = vi.fn();
    const { getByLabelText } = render(<Harness go={go} withBox />);
    await userEvent.setup().keyboard('/');
    expect(getByLabelText('Search videos')).toHaveFocus();
    expect(go).not.toHaveBeenCalled();
  });

  it('opens the search page when there is no search box on screen', async () => {
    const go = vi.fn();
    render(<Harness go={go} />);
    await userEvent.setup().keyboard('/');
    expect(go).toHaveBeenCalledWith('/search');
  });

  it('is ignored while typing in another field', async () => {
    const go = vi.fn();
    const { getByLabelText } = render(<Harness go={go} withBox />);
    const user = userEvent.setup();
    await user.click(getByLabelText('Other'));
    await user.keyboard('/');
    expect(getByLabelText('Other')).toHaveFocus();
    expect(getByLabelText('Other')).toHaveValue('/');
    expect(go).not.toHaveBeenCalled();
  });

  it('is ignored with a modifier key', async () => {
    const go = vi.fn();
    render(<Harness go={go} />);
    await userEvent.setup().keyboard('{Control>}/{/Control}');
    expect(go).not.toHaveBeenCalled();
  });
});
