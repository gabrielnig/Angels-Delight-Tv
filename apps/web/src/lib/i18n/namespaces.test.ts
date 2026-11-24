import { describe, expect, it } from 'vitest';
import { pickNamespaces } from './namespaces';

const catalog = { 'common.a': 'A', 'player.b': 'B', 'account.c': 'C' };

describe('pickNamespaces', () => {
  it('only the requested namespaces reach the client', () => {
    expect(pickNamespaces(catalog, ['common', 'player'])).toEqual({ 'common.a': 'A', 'player.b': 'B' });
  });
  it('an unknown namespace is an error in dev and ignored in production', () => {
    expect(() => pickNamespaces(catalog, ['nope'], { production: false })).toThrow(/nope/);
    expect(pickNamespaces(catalog, ['nope', 'common'], { production: true })).toEqual({ 'common.a': 'A' });
  });
});
