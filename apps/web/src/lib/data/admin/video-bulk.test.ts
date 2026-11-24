import { describe, expect, it } from 'vitest';
import {
  buildUndo,
  markRetryable,
  planUndo,
  runVideoBulk,
  snapshotOf,
  undoRestoreVideos,
  undoVideoBulk,
  type VideoSnapshot,
} from './video-bulk';

const snap = (over: Partial<VideoSnapshot> = {}): VideoSnapshot => ({
  publishState: 'draft',
  suitability: null,
  categoryIds: [],
  captionsEnabled: null,
  captionsOffReason: null,
  ...over,
});

describe('markRetryable', () => {
  it('marks only failures that are not permanent', () => {
    const out = markRetryable([
      { id: 'a', reason: 'Not ready: Poster needs attention first.' },
      { id: 'b', reason: 'You do not have permission for this.' },
      { id: 'c', reason: 'That video no longer exists.' },
      { id: 'd', reason: 'Only an admin can move videos to Trash.' },
      { id: 'e', reason: 'Something went wrong.' },
    ]);
    expect(out.map((f) => f.retryable === true)).toEqual([false, false, false, false, true]);
  });
});

describe('undo for videos (L3-D07)', () => {
  it('undo after trash restores the same ids', () => {
    const undo = buildUndo({ type: 'trash' }, { a: snap(), b: snap() }, ['a', 'b']);
    expect(undo?.label).toMatch(/Trash/);
    expect(planUndo(undo!, {})).toEqual([{ kind: 'restore', ids: ['a', 'b'] }]);
  });

  it('undo of publish unpublishes only ids that were not published before and still are', () => {
    const undo = buildUndo(
      { type: 'publish' },
      { a: snap({ publishState: 'draft' }), b: snap({ publishState: 'published' }), c: snap({ publishState: 'draft' }) },
      ['a', 'b', 'c'],
    );
    const steps = planUndo(undo!, {
      a: snap({ publishState: 'published' }),
      b: snap({ publishState: 'published' }),
      c: snap({ publishState: 'unpublished' }),
    });
    expect(steps).toEqual([{ kind: 'bulk', action: { type: 'unpublish' }, ids: ['a'] }]);
  });

  it('undo of unpublish republishes ids that were published and are still unpublished', () => {
    const undo = buildUndo({ type: 'unpublish' }, { a: snap({ publishState: 'published' }), b: snap({ publishState: 'draft' }) }, ['a', 'b']);
    const steps = planUndo(undo!, { a: snap({ publishState: 'unpublished' }), b: snap({ publishState: 'unpublished' }) });
    expect(steps).toEqual([{ kind: 'bulk', action: { type: 'publish' }, ids: ['a'] }]);
  });

  it('undo of add category removes it only where it was added and is still there', () => {
    const undo = buildUndo({ type: 'category', categoryId: 'c1' }, { a: snap({ categoryIds: ['c1'] }), b: snap() }, ['a', 'b']);
    const steps = planUndo(undo!, { a: snap({ categoryIds: ['c1'] }), b: snap({ categoryIds: ['c1'] }) });
    expect(steps).toEqual([{ kind: 'bulk', action: { type: 'remove_category', categoryId: 'c1' }, ids: ['b'] }]);
  });

  it('undo of remove category adds it back where it was removed', () => {
    const undo = buildUndo({ type: 'remove_category', categoryId: 'c1' }, { a: snap({ categoryIds: ['c1'] }) }, ['a']);
    expect(planUndo(undo!, { a: snap() })).toEqual([
      { kind: 'bulk', action: { type: 'category', categoryId: 'c1' }, ids: ['a'] },
    ]);
  });

  it('bulk results carry an undo that restores previous suitability per id', () => {
    const undo = buildUndo(
      { type: 'suitability', value: 'kids' },
      { a: snap({ suitability: 'everyone' }), b: snap({ suitability: 'older' }), c: snap({ suitability: 'everyone' }) },
      ['a', 'b', 'c'],
    );
    const steps = planUndo(undo!, {
      a: snap({ suitability: 'kids' }),
      b: snap({ suitability: 'kids' }),
      c: snap({ suitability: 'older' }),
    });
    expect(steps).toEqual([
      { kind: 'bulk', action: { type: 'suitability', value: 'everyone' }, ids: ['a'], expectSuitability: 'kids' },
      { kind: 'bulk', action: { type: 'suitability', value: 'older' }, ids: ['b'], expectSuitability: 'kids' },
    ]);
  });

  it('undo of a captions switch restores each previous tri state, only where it is still as the run left it', () => {
    const undo = buildUndo(
      { type: 'captions_available', value: false, reason: 'No spoken words' },
      {
        a: snap({ captionsEnabled: null }),
        b: snap({ captionsEnabled: true }),
        c: snap({ captionsEnabled: false, captionsOffReason: 'Music only video' }),
        d: snap({ captionsEnabled: null }),
      },
      ['a', 'b', 'c', 'd'],
    );
    const steps = planUndo(undo!, {
      a: snap({ captionsEnabled: false }),
      b: snap({ captionsEnabled: false }),
      c: snap({ captionsEnabled: false }),
      d: snap({ captionsEnabled: true }),
    });
    expect(steps).toEqual([
      { kind: 'bulk', action: { type: 'captions_available', value: null }, ids: ['a'], expectCaptions: false },
      { kind: 'bulk', action: { type: 'captions_available', value: true }, ids: ['b'], expectCaptions: false },
    ]);
  });

  it('nothing to undo returns no descriptor', () => {
    expect(buildUndo({ type: 'trash' }, {}, [])).toBeUndefined();
    expect(buildUndo({ type: 'publish' }, { a: snap({ publishState: 'published' }) }, ['a'])).toBeUndefined();
  });

  it('snapshotOf keeps only what undo needs', () => {
    expect(
      snapshotOf({ publishState: 'published', suitability: 'kids', categoryIds: ['x'], title: 'T' } as never),
    ).toEqual({
      publishState: 'published',
      suitability: 'kids',
      categoryIds: ['x'],
      captionsEnabled: null,
      captionsOffReason: null,
    });
  });
});

describe('runVideoBulk and undoVideoBulk', () => {
  const makeService = () => {
    const state: Record<string, { publishState: string; deleted?: boolean }> = {
      a: { publishState: 'draft' },
      b: { publishState: 'draft' },
    };
    const calls: string[] = [];
    const service = {
      async get(_actor: unknown, id: string) {
        const row = state[id];
        if (!row || row.deleted) throw new Error('missing');
        return { id, publishState: row.publishState, suitability: null, categoryIds: [] } as never;
      },
      async bulk(_actor: unknown, ids: string[], action: { type: string }) {
        calls.push(`${action.type}:${ids.join(',')}`);
        for (const id of ids) {
          if (action.type === 'publish') state[id]!.publishState = 'published';
          if (action.type === 'unpublish') state[id]!.publishState = 'unpublished';
          if (action.type === 'trash') state[id]!.deleted = true;
        }
        return { succeeded: ids, failed: [] };
      },
      async restore(_actor: unknown, id: string) {
        calls.push(`restore:${id}`);
        state[id]!.deleted = false;
        return { ok: true as const };
      },
    };
    return { service, state, calls };
  };
  const actor = {} as never;

  it('a run returns the bulk id, retryable marks and an undo descriptor', async () => {
    const { service } = makeService();
    const out = await runVideoBulk(service as never, actor, ['a', 'b'], { type: 'publish' }, 'bulk-9');
    expect(out.bulkId).toBe('bulk-9');
    expect(out.succeeded).toEqual(['a', 'b']);
    expect(out.undo).toBeDefined();
  });

  it('undo after trash restores the same ids', async () => {
    const { service, state } = makeService();
    const out = await runVideoBulk(service as never, actor, ['a', 'b'], { type: 'trash' }, 'x');
    expect(state.a!.deleted).toBe(true);
    const undone = await undoVideoBulk(service as never, actor, out.undo!);
    expect(undone.succeeded).toEqual(['a', 'b']);
    expect(state.a!.deleted).toBe(false);
  });

  it('undo of publish skips a video someone else already unpublished', async () => {
    const { service, state, calls } = makeService();
    const out = await runVideoBulk(service as never, actor, ['a', 'b'], { type: 'publish' }, 'x');
    state.b!.publishState = 'unpublished';
    const undone = await undoVideoBulk(service as never, actor, out.undo!);
    expect(undone.succeeded).toEqual(['a']);
    expect(calls.at(-1)).toBe('unpublish:a');
  });

  it('undo of a restore puts videos back in Trash only while they are still drafts', async () => {
    const { service, state, calls } = makeService();
    state.b!.publishState = 'published';
    const undone = await undoRestoreVideos(service as never, actor, ['a', 'b', 'gone']);
    expect(undone.succeeded).toEqual(['a']);
    expect(calls.at(-1)).toBe('trash:a');
    expect(state.b!.deleted).toBeUndefined();
    expect(undone.failed.map((f) => f.id)).toEqual(['b', 'gone']);
  });
});
