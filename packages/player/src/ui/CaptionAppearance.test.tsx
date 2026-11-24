// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CAPTION_STYLE,
  contrastRatio,
  resolveCaptionColors,
  type CaptionStyle,
} from '../captionStyle';
import { CaptionAppearance } from './CaptionAppearance';

afterEach(cleanup);

function Harness({
  onChange,
  initial,
}: {
  onChange?(s: CaptionStyle): void;
  initial?: CaptionStyle;
}) {
  const [style, setStyle] = useState(initial ?? DEFAULT_CAPTION_STYLE);
  return (
    <CaptionAppearance
      style={style}
      onChange={(next) => {
        setStyle(next);
        onChange?.(next);
      }}
      onClose={() => undefined}
    />
  );
}

describe('CaptionAppearance (L4-07)', () => {
  it('changes size, background, contrast and edge with a live preview', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const preview = screen.getByTestId('caption-appearance-preview');
    const before = preview.style.getPropertyValue('--adp-cap-size');

    await user.click(screen.getByRole('menuitemradio', { name: 'Size, Extra large' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ size: 'xlarge' }));
    expect(preview.style.getPropertyValue('--adp-cap-size')).not.toBe(before);

    await user.click(screen.getByRole('menuitemradio', { name: 'Background, Solid' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ background: 'solid' }));

    await user.click(screen.getByRole('menuitemradio', { name: 'Contrast, High' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ contrast: 'high' }));

    const edgeBefore = preview.style.getPropertyValue('--adp-cue-edge');
    await user.click(screen.getByRole('menuitemradio', { name: 'Edge, Outline' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ edge: 'outline' }));
    expect(preview.style.getPropertyValue('--adp-cue-edge')).not.toBe(edgeBefore);
  });

  it('marks the current choice in each group', () => {
    render(<Harness />);
    expect(
      screen.getByRole('menuitemradio', { name: 'Edge, Shadow' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('menuitemradio', { name: 'Edge, Outline' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('preview meets 4.5 to 1 contrast in high contrast', () => {
    for (const background of ['none', 'dark', 'solid'] as const) {
      const { fg, bg } = resolveCaptionColors({
        ...DEFAULT_CAPTION_STYLE,
        background,
        contrast: 'high',
      });
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reset restores the default', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness
        onChange={onChange}
        initial={{
          size: 'xlarge',
          background: 'solid',
          contrast: 'high',
          edge: 'outline',
          color: 'white',
        }}
      />,
    );
    await user.click(screen.getByRole('menuitem', { name: 'Reset to default' }));
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_CAPTION_STYLE);
  });

  it('announces each change', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const status = screen.getByRole('status');
    await user.click(screen.getByRole('menuitemradio', { name: 'Size, Large' }));
    expect(status.textContent).toBe('Size: Large');
    await user.click(screen.getByRole('menuitemradio', { name: 'Edge, Outline' }));
    expect(status.textContent).toBe('Edge: Outline');
  });

  it('says when Edge None is shown as Shadow on a clear background (L4-D19)', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...DEFAULT_CAPTION_STYLE, background: 'none' }} />);
    await user.click(screen.getByRole('menuitemradio', { name: 'Edge, None' }));
    const group = screen.getByRole('group', { name: 'Edge' });
    expect(within(group).getByText(/shown as shadow/i)).toBeTruthy();
    expect(
      screen.getByTestId('caption-appearance-preview').style.getPropertyValue('--adp-cue-edge'),
    ).not.toBe('none');
  });
});
