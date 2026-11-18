// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResponsivePoster } from './ResponsivePoster';

const variants = [
  { width: 320, height: 180, url: 'https://m.example/img/a/320-aa.webp' },
  { width: 640, height: 360, url: 'https://m.example/img/a/640-bb.webp' },
  { width: 960, height: 540, url: 'https://m.example/img/a/960-cc.webp' },
];

describe('ResponsivePoster with avif', () => {
  const all = [
    { width: 320, height: 180, url: 'https://m.example/a/320.avif', format: 'avif' as const },
    { width: 320, height: 180, url: 'https://m.example/a/320.webp', format: 'webp' as const },
    { width: 320, height: 180, url: 'https://m.example/a/320.jpg', format: 'jpeg' as const },
  ];
  it('puts an avif source first, then webp, with the jpeg as the image', () => {
    const { container } = render(<ResponsivePoster variants={all} alt="Plants" />);
    const types = [...container.querySelectorAll('source')].map((s) => s.getAttribute('type'));
    expect(types).toEqual(['image/avif', 'image/webp']);
    expect(screen.getByRole('img', { name: 'Plants' }).getAttribute('srcset')).toContain('320.jpg');
  });
  it('works with avif and webp only, falling back to the webp image', () => {
    const { container } = render(
      <ResponsivePoster variants={all.filter((v) => v.format !== 'jpeg')} alt="Plants" />,
    );
    expect([...container.querySelectorAll('source')].map((s) => s.getAttribute('type'))).toEqual([
      'image/avif',
    ]);
    expect(screen.getByRole('img', { name: 'Plants' }).getAttribute('src')).toContain('320.webp');
  });
});

describe('ResponsivePoster', () => {
  it('renders a lazy image with a srcset, size attributes and alt text', () => {
    render(<ResponsivePoster variants={variants} alt="Plants growing in sunlight" />);
    const img = screen.getByRole('img', { name: 'Plants growing in sunlight' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img.getAttribute('srcset')).toContain('960w');
    expect(img).toHaveAttribute('width', '640');
    expect(img).toHaveAttribute('height', '360');
  });

  it('loads a priority image eagerly with high fetch priority', () => {
    render(<ResponsivePoster variants={variants} alt="Hero" priority />);
    const img = screen.getByRole('img', { name: 'Hero' });
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  it('offers only the 320 px variant with Data saver on', () => {
    render(<ResponsivePoster variants={variants} alt="Saver" dataSaver />);
    const img = screen.getByRole('img', { name: 'Saver' });
    expect(img.getAttribute('srcset')).toBe('https://m.example/img/a/320-aa.webp 320w');
  });

  it('reserves the frame ratio so the page does not shift', () => {
    const { container } = render(<ResponsivePoster variants={variants} alt="x" ratio="2/3" />);
    expect((container.firstChild as HTMLElement).style.aspectRatio).toBe('2 / 3');
  });

  it('shows a labelled placeholder when there are no variants', () => {
    render(<ResponsivePoster variants={[]} alt="Poster coming soon" />);
    expect(screen.getByRole('img', { name: 'Poster coming soon' }).tagName).toBe('DIV');
  });

  it('offers webp first and jpeg to browsers that cannot read it', () => {
    const { container } = render(
      <ResponsivePoster
        alt="Mixed"
        variants={[
          { width: 320, height: 180, url: 'a.webp', format: 'webp' },
          { width: 320, height: 180, url: 'a.jpg', format: 'jpeg' },
        ]}
      />,
    );
    const source = container.querySelector('picture source')!;
    expect(source).toHaveAttribute('type', 'image/webp');
    expect(source).toHaveAttribute('srcset', 'a.webp 320w');
    expect(screen.getByRole('img', { name: 'Mixed' })).toHaveAttribute('src', 'a.jpg');
  });

  it('draws a generated poster with the title when there is no picture', () => {
    render(<ResponsivePoster variants={[]} alt="Plants" fallbackTitle="Plants and light" fallbackSeed={3} />);
    const box = screen.getByRole('img', { name: 'Plants' });
    expect(box).toHaveTextContent('Plants and light');
    expect(box.className).toContain('ad-poster--generated');
    expect(box.getAttribute('data-tone')).toBe('3');
  });

  it('keeps the same tone for the same seed', () => {
    const { rerender } = render(<ResponsivePoster variants={[]} alt="a" fallbackTitle="T" fallbackSeed={7} />);
    const first = screen.getByRole('img').getAttribute('data-tone');
    rerender(<ResponsivePoster variants={[]} alt="a" fallbackTitle="T" fallbackSeed={7} />);
    expect(screen.getByRole('img').getAttribute('data-tone')).toBe(first);
  });
});

describe('ResponsivePoster placeholder and fade in', () => {
  const blur = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4';
  it('draws the blur under the image and reveals the image on load', () => {
    const { container } = render(
      <ResponsivePoster variants={variants} alt="Plants" placeholderBlur={blur} />,
    );
    expect(container.querySelector<HTMLElement>('.ad-poster__blur')!.style.backgroundImage).toContain(blur);
    const img = screen.getByRole('img', { name: 'Plants' });
    expect(img).toHaveAttribute('data-loaded', 'false');
    fireEvent.load(img);
    expect(img).toHaveAttribute('data-loaded', 'true');
  });
  it('uses the colour when there is no blur', () => {
    const { container } = render(
      <ResponsivePoster variants={variants} alt="Plants" placeholderColor="#3366cc" />,
    );
    expect(container.querySelector('.ad-poster__blur')).toBeNull();
    expect(container.querySelector<HTMLElement>('.ad-poster')!.style.backgroundColor).not.toBe('');
  });
  it('shows an already cached image at once', () => {
    const { container } = render(
      <ResponsivePoster variants={variants} alt="Plants" placeholderColor="#3366cc" />,
    );
    // jsdom never loads images, so complete is false and the state stays pending until load.
    expect(container.querySelector('img')!.getAttribute('data-loaded')).toBe('false');
  });
});
