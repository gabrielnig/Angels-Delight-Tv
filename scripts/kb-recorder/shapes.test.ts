import { describe, expect, it } from 'vitest';
import { cropRect, planShapes } from './shapes';

const view = { width: 1280, height: 720 };

describe('planShapes', () => {
  it('numbers highlighted marks in order and leaves blurs unnumbered', () => {
    const shapes = planShapes(
      [
        { rect: { x: 100, y: 100, width: 200, height: 40 } },
        { rect: { x: 400, y: 300, width: 160, height: 30 }, kind: 'blur' },
        { rect: { x: 600, y: 100, width: 100, height: 40 } },
      ],
      view,
    );
    expect(shapes.badges.map((b) => b.n)).toEqual([1, 2]);
    expect(shapes.blurs).toHaveLength(1);
    expect(shapes.highlights).toHaveLength(2);
  });

  it('draws an arrow only when asked and when the badge does not already touch the target', () => {
    const near = planShapes(
      [{ rect: { x: 100, y: 100, width: 200, height: 40 }, arrow: true }],
      view,
    );
    expect(near.arrows.length).toBeLessThanOrEqual(1);
    const none = planShapes([{ rect: { x: 100, y: 100, width: 200, height: 40 } }], view);
    expect(none.arrows).toEqual([]);
  });

  it('keeps every badge inside the viewport', () => {
    const s = planShapes(
      [
        { rect: { x: 0, y: 0, width: 50, height: 20 } },
        { rect: { x: 1270, y: 710, width: 10, height: 10 } },
      ],
      view,
    );
    for (const b of s.badges) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.size).toBeLessThanOrEqual(view.width);
      expect(b.y + b.size).toBeLessThanOrEqual(view.height);
    }
  });

  it('pads a blur so no edge of the text shows', () => {
    const [b] = planShapes(
      [{ rect: { x: 100, y: 100, width: 100, height: 20 }, kind: 'blur' }],
      view,
    ).blurs;
    expect(b!.x).toBeLessThan(100);
    expect(b!.width).toBeGreaterThan(100);
  });
});

describe('cropRect', () => {
  it('pads a card and clamps to the viewport', () => {
    expect(cropRect({ x: 10, y: 10, width: 300, height: 200 }, view, 16)).toEqual({
      x: 0,
      y: 0,
      width: 326,
      height: 226,
    });
    expect(cropRect({ x: 1000, y: 600, width: 300, height: 200 }, view, 16)).toEqual({
      x: 984,
      y: 584,
      width: 296,
      height: 136,
    });
  });

  it('never returns less than a minimum size so a tiny target is not a thumbnail', () => {
    const r = cropRect({ x: 500, y: 300, width: 20, height: 20 }, view, 4, {
      minWidth: 320,
      minHeight: 200,
    });
    expect(r.width).toBeGreaterThanOrEqual(320);
    expect(r.height).toBeGreaterThanOrEqual(200);
  });
});
