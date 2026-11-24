// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultHome } from '@/lib/data/admin/home-rules';
import { getStore } from '@/lib/data/admin/store';
import { HeroSlots } from './HeroSlots';

afterEach(cleanup);
const s = structuredClone(getStore());
const video = s.videos.find((v) => v.publishState === 'published')!;

const show = (heroText = {}, canCurate = true) => {
  const onChange = vi.fn();
  render(
    <HeroSlots
      config={{ ...defaultHome(), heroIds: [video.id], heroText }}
      videos={s.videos}
      canCurate={canCurate}
      onChange={onChange}
    />,
  );
  return onChange;
};

describe('HeroSlots', () => {
  it('shows headline, description and button label with the title as the fallback', () => {
    show();
    expect(screen.getByLabelText(`Headline for ${video.title}`)).toBeTruthy();
    expect(screen.getByLabelText(`Description for ${video.title}`)).toBeTruthy();
    expect(screen.getByLabelText(`Button label for ${video.title}`)).toBeTruthy();
    expect(screen.getAllByText(/Leave blank to use the title/).length).toBeGreaterThan(0);
  });

  it('reports a change with the typed words', () => {
    const onChange = show();
    fireEvent.change(screen.getByLabelText(`Headline for ${video.title}`), {
      target: { value: 'Start here' },
    });
    expect(onChange.mock.calls[0]![0].heroText).toEqual({ [video.id]: { headline: 'Start here' } });
  });

  it('counts characters out of 80 and locks the fields without curate rights', () => {
    show({ [video.id]: { headline: 'Start here' } }, false);
    expect(screen.getByText('10 of 80')).toBeTruthy();
    expect((screen.getByLabelText(`Headline for ${video.title}`) as HTMLInputElement).disabled).toBe(true);
  });
});
