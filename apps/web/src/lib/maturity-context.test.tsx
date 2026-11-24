// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MaturityLabelsProvider, useMaturityLabel, useMaturityLabels } from './maturity-context';

function Probe({ rank }: { rank: number }) {
  const label = useMaturityLabel(rank);
  const all = useMaturityLabels();
  return (
    <p>
      {label}|{all.join(',')}
    </p>
  );
}

describe('maturity labels context (R20)', () => {
  it('falls back to G, PG, 12, 15, 18 without a provider', () => {
    render(<Probe rank={3} />);
    expect(screen.getByText('15|G,PG,12,15,18')).toBeInTheDocument();
  });

  it('uses the configured labels', () => {
    render(
      <MaturityLabelsProvider labels={['All', '7+', '13+', '16+', '18+']}>
        <Probe rank={1} />
      </MaturityLabelsProvider>,
    );
    expect(screen.getByText('7+|All,7+,13+,16+,18+')).toBeInTheDocument();
  });

  it('clamps an out of range rank', () => {
    render(<Probe rank={9} />);
    expect(screen.getByText(/^18\|/)).toBeInTheDocument();
  });
});
