// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JsonLd } from './JsonLd';

describe('JsonLd (M45-S02)', () => {
  it('renders one ld+json script carrying the data', () => {
    const { container } = render(<JsonLd data={{ '@type': 'VideoObject', name: 'A' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent ?? '')).toEqual({ '@type': 'VideoObject', name: 'A' });
  });

  it('cannot be broken out of by a title', () => {
    const { container } = render(
      <JsonLd data={{ name: '</script><img src=x onerror=alert(1)>' }} />,
    );
    expect(container.querySelectorAll('script')).toHaveLength(1);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing when the data could not be built', () => {
    const { container } = render(<JsonLd data={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders several blocks as separate scripts', () => {
    const { container } = render(<JsonLd data={[{ a: 1 }, null, { b: 2 }]} />);
    expect(container.querySelectorAll('script')).toHaveLength(2);
  });
});
