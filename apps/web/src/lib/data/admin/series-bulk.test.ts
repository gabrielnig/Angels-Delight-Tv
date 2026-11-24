import { describe, expect, it } from 'vitest';
import { deleteSeries, updateSeries } from './collection-commands';
import { planSeriesUndo, runSeriesBulk, type SeriesBulkService } from './series-bulk';
import { seedStore } from './store';

const NOW = Date.parse('2026-11-17T09:00:00Z');

function setup(role: 'admin' | 'editor' = 'admin') {
  const store = seedStore(NOW);
  const service: SeriesBulkService = {
    async list() {
      return store.series.map((s) => ({ id: s.id, published: s.published }));
    },
    async update(id, patch) {
      return updateSeries(store, id, patch);
    },
    async remove(id) {
      if (role !== 'admin') return { ok: false, error: 'Only an admin can delete a series.' };
      return deleteSeries(store, id);
    },
  };
  store.series.push({ id: 'ser_empty', title: 'Empty', description: '', posterId: null, published: false });
  return { store, service };
}

describe('runSeriesBulk', () => {
  it('publish skips a series with no published episode, with a reason, and publishes the rest', async () => {
    const { store, service } = setup();
    const maths = store.series.find((s) => s.id === 'ser_maths')!;
    maths.published = false;
    const out = await runSeriesBulk(service, ['ser_maths', 'ser_empty'], { type: 'publish' }, 'b1');
    expect(out.succeeded).toEqual(['ser_maths']);
    expect(out.skipped).toEqual([
      { id: 'ser_empty', reason: 'Publish at least one episode before publishing the series.' },
    ]);
    expect(maths.published).toBe(true);
    expect(out.bulkId).toBe('b1');
  });

  it('skips a series that is already in the wanted state', async () => {
    const { store, service } = setup();
    store.series.find((s) => s.id === 'ser_maths')!.published = true;
    const out = await runSeriesBulk(service, ['ser_maths'], { type: 'publish' }, 'b');
    expect(out.skipped).toEqual([{ id: 'ser_maths', reason: 'Already published.' }]);
    const off = await runSeriesBulk(service, ['ser_empty'], { type: 'unpublish' }, 'b');
    expect(off.skipped).toEqual([{ id: 'ser_empty', reason: 'Not published.' }]);
  });

  it('delete detaches episodes and removes the series, and has no undo', async () => {
    const { store, service } = setup();
    const out = await runSeriesBulk(service, ['ser_maths'], { type: 'delete' }, 'b');
    expect(out.succeeded).toEqual(['ser_maths']);
    expect(out.undo).toBeUndefined();
    expect(store.series.some((s) => s.id === 'ser_maths')).toBe(false);
    expect(store.videos.some((v) => v.seriesId === 'ser_maths')).toBe(false);
  });

  it('delete is refused for editors, per series, and not retryable', async () => {
    const { store, service } = setup('editor');
    const out = await runSeriesBulk(service, ['ser_maths'], { type: 'delete' }, 'b');
    expect(out.succeeded).toEqual([]);
    expect(out.failed).toEqual([
      { id: 'ser_maths', reason: 'Only an admin can delete a series.', retryable: false },
    ]);
    expect(store.series.some((s) => s.id === 'ser_maths')).toBe(true);
  });

  it('unpublish undo restores the published state, only where it is still unpublished', async () => {
    const { store, service } = setup();
    store.series.find((s) => s.id === 'ser_maths')!.published = true;
    const out = await runSeriesBulk(service, ['ser_maths'], { type: 'unpublish' }, 'b');
    expect(out.succeeded).toEqual(['ser_maths']);
    expect(planSeriesUndo(out.undo!, { ser_maths: false })).toEqual([
      { type: 'publish', ids: ['ser_maths'] },
    ]);
    expect(planSeriesUndo(out.undo!, { ser_maths: true })).toEqual([]);
  });
});
