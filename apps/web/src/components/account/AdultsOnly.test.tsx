// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdultsOnly } from './AccountStates';

describe('AdultsOnly', () => {
  it('sits inside the acct scope so the heading tokens apply (S27 state 4)', () => {
    const { container } = render(<AdultsOnly profileName="Amina" />);
    expect(container.firstElementChild?.classList.contains('acct')).toBe(true);
  });
});
