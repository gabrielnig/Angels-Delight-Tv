import { describe, expect, it } from 'vitest';
import { buildSpriteVtt, planSprite, spriteArgs } from './sprite';

describe('planSprite', () => {
  it('takes a frame every 5 seconds, 5 across, 25 to a sheet', () => {
    const plan = planSprite({ durationSeconds: 600, width: 1280, height: 720 });
    expect(plan).toMatchObject({
      intervalSeconds: 5,
      columns: 5,
      tileWidth: 160,
      tileHeight: 90,
      frames: 120,
      perSheet: 25,
      sheets: 5,
    });
  });

  it('keeps tile height even and follows the picture shape', () => {
    expect(planSprite({ durationSeconds: 60, width: 1080, height: 1920 })!.tileHeight).toBe(284);
    expect(planSprite({ durationSeconds: 60, width: 1000, height: 1000 })!.tileHeight).toBe(160);
  });

  it('stretches the interval so a long video stays within 10 sheets', () => {
    const plan = planSprite({ durationSeconds: 3 * 3600, width: 1280, height: 720 })!;
    expect(plan.sheets).toBeLessThanOrEqual(10);
    expect(plan.intervalSeconds).toBeGreaterThan(5);
  });

  it('plans one frame for a very short video and nothing for no duration', () => {
    expect(planSprite({ durationSeconds: 2, width: 1280, height: 720 })!.frames).toBe(1);
    expect(planSprite({ durationSeconds: 0, width: 1280, height: 720 })).toBeNull();
  });
});

describe('buildSpriteVtt', () => {
  const plan = planSprite({ durationSeconds: 62, width: 1280, height: 720 })!;
  const vtt = buildSpriteVtt(plan, 62, ['s1.jpg']);

  it('maps every interval to a tile of a sheet', () => {
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:05.000\ns1.jpg#xywh=0,0,160,90');
    expect(vtt).toContain('00:00:05.000 --> 00:00:10.000\ns1.jpg#xywh=160,0,160,90');
    expect(vtt).toContain('00:00:25.000 --> 00:00:30.000\ns1.jpg#xywh=0,90,160,90');
  });

  it('ends the last cue at the duration', () => {
    expect(vtt.trim().split('\n\n').pop()).toContain('00:01:00.000 --> 00:01:02.000');
  });

  it('moves to the next sheet after 25 tiles', () => {
    const big = planSprite({ durationSeconds: 300, width: 1280, height: 720 })!;
    const text = buildSpriteVtt(big, 300, ['a.jpg', 'b.jpg', 'c.jpg']);
    expect(text).toContain('00:02:05.000 --> 00:02:10.000\nb.jpg#xywh=0,0,160,90');
  });

  it('refuses a sheet list that is too short', () => {
    const big = planSprite({ durationSeconds: 300, width: 1280, height: 720 })!;
    expect(() => buildSpriteVtt(big, 300, ['a.jpg'])).toThrow(/sheets/);
  });
});

describe('spriteArgs', () => {
  it('samples one frame per interval and tiles them into numbered jpeg sheets', () => {
    const plan = planSprite({ durationSeconds: 600, width: 1280, height: 720 })!;
    const args = spriteArgs({ input: '/in', container: 'mp4', plan, outputPattern: '/out/s-%03d.jpg' });
    expect(args).toContain('fps=1/5,scale=160:90,tile=5x5');
    expect(args.at(-1)).toBe('/out/s-%03d.jpg');
    expect(args).toContain('-an');
  });
});
