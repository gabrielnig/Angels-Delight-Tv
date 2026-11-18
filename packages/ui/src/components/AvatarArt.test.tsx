// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';
import { AVATAR_ART, AVATAR_ART_IDS } from './AvatarArt';

describe('illustrated avatars', () => {
  it('has twelve distinct originals with plain labels', () => {
    expect(AVATAR_ART_IDS).toHaveLength(12);
    expect(new Set(AVATAR_ART_IDS).size).toBe(12);
    for (const id of AVATAR_ART_IDS) expect(AVATAR_ART[id].label.length).toBeGreaterThan(2);
  });

  it.each(AVATAR_ART_IDS)(
    '%s draws inline svg with no colour literals, hidden from readers',
    (id) => {
      const { container } = render(<Avatar name="Ada" avatarId={id} size={64} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb|hsl/);
      expect(container.textContent).toBe('');
    },
  );

  it('uses the avatar tone for the background', () => {
    const { container } = render(<Avatar name="Ada" avatarId="sun" />);
    expect(container.querySelector('.ad-avatar')?.getAttribute('data-tone')).toBe(
      AVATAR_ART.sun.tone,
    );
  });

  it('falls back to the first letter for an unknown id', () => {
    const { container } = render(<Avatar name="Ada" avatarId="nope" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('A');
  });
});
