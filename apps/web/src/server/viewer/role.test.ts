import { describe, expect, it } from 'vitest';
import { viewerActorFor } from './runtime-actor';

describe('viewer api actor (L-1)', () => {
  it('always acts as a viewer, even for a staff session', () => {
    expect(viewerActorFor({ accountId: 'a1', role: 'admin' })).toEqual({
      accountId: 'a1',
      role: 'viewer',
    });
    expect(viewerActorFor({ accountId: 'a2', role: 'editor' }).role).toBe('viewer');
  });
});
