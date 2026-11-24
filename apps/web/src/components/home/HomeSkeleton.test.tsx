// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/data', () => ({}));
vi.mock('../../app/actions', () => ({}));
vi.mock('../../lib/data/admin/theme-runtime', () => ({}));
vi.mock('../../server/sponsors/surface-runtime', () => ({}));

import { HomeSkeleton } from './HomeView';

const web = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
const ui = readFileSync(join(__dirname, '../../../../../packages/ui/src/components.css'), 'utf8');

/** The declarations of the first rule for `selector`, optionally the one inside `@media (min-width: 960px)`. */
function rule(css: string, selector: string, desktop: boolean): string {
  const scope = desktop ? css.slice(css.indexOf('@media (min-width: 960px)', css.indexOf(selector))) : css;
  const start = scope.indexOf(`${selector} {`);
  if (start < 0) return '';
  return scope.slice(start, scope.indexOf('}', start));
}
const prop = (body: string, name: string) => body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];

describe('HomeSkeleton hero box (F09)', () => {
  it('is announced as loading and draws the hero box and two rows', async () => {
    const { container } = render(<HomeSkeleton />);
    expect(await screen.findByText('Loading Home')).toBeTruthy();
    expect(container.querySelector('.web-hero-skeleton')).not.toBeNull();
    expect(container.querySelectorAll('.web-rowskel').length).toBe(2);
  });

  it('uses the same ratio tokens as the hero slide on phones and from 960 px', () => {
    const slideMobile = rule(ui, '.ad-hero__slide', false);
    const skelMobile = rule(web, '.web-hero-skeleton', false);
    expect(prop(skelMobile, 'aspect-ratio')).toBe(prop(slideMobile, 'aspect-ratio'));
    expect(prop(skelMobile, 'aspect-ratio')).toBe('var(--ratio-hero-mobile)');
    const slideDesktop = rule(ui, '.ad-hero__slide', true);
    const skelDesktop = rule(web, '.web-hero-skeleton', true);
    expect(prop(skelDesktop, 'aspect-ratio')).toBe(prop(slideDesktop, 'aspect-ratio'));
    expect(prop(skelDesktop, 'aspect-ratio')).toBe('var(--ratio-hero)');
  });

  it('caps its height like the slide, so the page does not jump when the hero arrives', () => {
    expect(prop(rule(web, '.web-hero-skeleton', false), 'max-height')).toBe(
      prop(rule(ui, '.ad-hero__slide', false), 'max-height'),
    );
    expect(prop(rule(web, '.web-hero-skeleton', true), 'max-height')).toBe(
      prop(rule(ui, '.ad-hero__slide', true), 'max-height'),
    );
  });
});
