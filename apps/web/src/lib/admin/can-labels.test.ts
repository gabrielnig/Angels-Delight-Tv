import { describe, expect, it } from 'vitest';
import { ADMIN_ACTIONS } from './can';
import { ACTION_LABELS } from './can-labels';

describe('ACTION_LABELS', () => {
  it('names every action in the matrix', () => {
    expect(Object.keys(ACTION_LABELS).sort()).toEqual([...ADMIN_ACTIONS].sort());
  });
});
