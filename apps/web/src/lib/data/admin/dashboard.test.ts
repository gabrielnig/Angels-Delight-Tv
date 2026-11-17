import { describe, expect, it } from 'vitest';
import { buildDashboard, greeting } from './dashboard';
import { seedStore } from './store';

const NOW = Date.parse('2026-11-17T09:00:00Z');
const admin = { accountId: 'a', role: 'admin', name: 'Chiamaka Okafor' } as const;
const editor = { accountId: 'e', role: 'editor', name: 'Ngozi Eze' } as const;

describe('greeting', () => {
  it('uses the first name, the time of day and the number of things to do', () => {
    expect(greeting('Chiamaka Okafor', 8, 4)).toBe(
      'Good morning, Chiamaka. Four things need you today.',
    );
    expect(greeting('Chiamaka Okafor', 14, 1)).toBe(
      'Good afternoon, Chiamaka. One thing needs you today.',
    );
    expect(greeting('Chiamaka Okafor', 20, 0)).toBe(
      'Good evening, Chiamaka. Nothing needs you right now.',
    );
  });
});

describe('buildDashboard', () => {
  const store = seedStore(NOW);

  it('counts live videos by state and ignores trashed ones', () => {
    const data = buildDashboard(admin, store, { now: NOW });
    expect(data.tiles.published.value).toBe(6);
    expect(data.tiles.processing.value).toBe(1);
    expect(data.tiles.failed.value).toBe(1);
    expect(data.tiles.drafts.value).toBeGreaterThanOrEqual(1);
    expect(data.isEmpty).toBe(false);
  });

  it('lists what needs attention: failed encode, captions to review, scheduled today, ready to publish', () => {
    const data = buildDashboard(admin, store, { now: NOW });
    expect(data.attention.map((a) => a.kind)).toEqual(['failed', 'captions', 'scheduled', 'ready']);
    expect(data.attention[0]).toMatchObject({
      title: 'Our Solar System did not finish encoding',
      detail: expect.stringContaining('The audio track could not be read.'),
      href: '/admin/encoding',
    });
    expect(data.attention[1]!.detail).toBe('84 cues waiting since yesterday.');
  });

  it('limits role restricted tiles for editors', () => {
    const data = buildDashboard(editor, store, { now: NOW });
    expect(data.storage.state).toBe('forbidden');
    expect(data.views.state).toBe('ready');
  });

  it('can simulate a failing tile without breaking the others', () => {
    const data = buildDashboard(admin, store, { now: NOW, failTiles: ['processing'] });
    expect(data.tiles.processing.state).toBe('error');
    expect(data.tiles.published.state).toBe('ready');
  });

  it('is empty when there are no videos', () => {
    const data = buildDashboard(admin, { ...store, videos: [] }, { now: NOW });
    expect(data.isEmpty).toBe(true);
  });

  it('gives seven days of views and a change on the week before', () => {
    const data = buildDashboard(admin, store, { now: NOW });
    expect(data.views.value!.days).toHaveLength(7);
    expect(data.views.value!.total).toBe(data.views.value!.days.reduce((s, d) => s + d.value, 0));
  });
});
