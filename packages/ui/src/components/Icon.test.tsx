import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, type IconName } from './Icon';

describe('Icon engagement glyphs', () => {
  it('exposes thumbUp, thumbDown, heart, bell, sort and filter as hidden outline paths', () => {
    for (const name of ['thumbUp', 'thumbDown', 'heart', 'bell', 'sort', 'filter'] as IconName[]) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(10);
      unmount();
    }
  });
});
