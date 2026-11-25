import { describe, expect, it } from 'vitest';
import { articleHref, helpTargetFor, HELP_HOME } from './help-map';

const map = {
  '/admin/videos/upload': ['D02'],
  '/admin/captions': ['D07'],
  '/admin/captions/[videoId]': ['D07', 'W07'],
};

describe('helpTargetFor', () => {
  it('opens the main article for a screen', () => {
    expect(helpTargetFor(map, '/admin/videos/upload')).toEqual({
      ids: ['D02'],
      href: '/admin/help/D02',
    });
  });
  it('matches dynamic routes and keeps the order of articles', () => {
    expect(helpTargetFor(map, '/admin/captions/abc-123')).toEqual({
      ids: ['D07', 'W07'],
      href: '/admin/help/D07',
    });
  });
  it('falls back to the help home when no article explains the page', () => {
    expect(helpTargetFor(map, '/admin/sponsors')).toEqual({ ids: [], href: HELP_HOME });
    expect(helpTargetFor(map, null)).toEqual({ ids: [], href: HELP_HOME });
  });
  it('sends help pages themselves to the home', () => {
    expect(helpTargetFor(map, '/admin/help/D02')).toEqual({ ids: [], href: HELP_HOME });
  });
});

describe('articleHref', () => {
  it('builds article, section and path links', () => {
    expect(articleHref('D02')).toBe('/admin/help/D02');
    expect(articleHref('D02', 'step-3')).toBe('/admin/help/D02#step-3');
  });
});
