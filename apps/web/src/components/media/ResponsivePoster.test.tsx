// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResponsivePoster } from './ResponsivePoster';

const variants = [
  { width: 320, height: 180, url: 'https://m.example/img/a/320-aa.webp' },
  { width: 640, height: 360, url: 'https://m.example/img/a/640-bb.webp' },
  { width: 960, height: 540, url: 'https://m.example/img/a/960-cc.webp' },
];

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
});
