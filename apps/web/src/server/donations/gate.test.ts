import { describe, expect, it } from 'vitest';
import { decideDonateGate, donateLinkVisible } from './gate';

describe('decideDonateGate', () => {
  it('is off whenever donations are not available, whoever asks, so the page is a 404 and no link exists', () => {
    expect(decideDonateGate({ available: false, kids: false })).toBe('off');
    expect(decideDonateGate({ available: false, kids: true })).toBe('off');
  });
  it('asks a kids audience to find a grown-up and shows the form to everyone else', () => {
    expect(decideDonateGate({ available: true, kids: true })).toBe('kids');
    expect(decideDonateGate({ available: true, kids: false })).toBe('ok');
  });
  it('shows the Donate link only for the ok gate, never for kids or when off', () => {
    expect(donateLinkVisible('ok')).toBe(true);
    expect(donateLinkVisible('kids')).toBe(false);
    expect(donateLinkVisible('off')).toBe(false);
  });
});
