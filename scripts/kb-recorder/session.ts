/// <reference lib="dom" />
import type { Locator, Page } from '@playwright/test';
import { arrowFor, placeBadge, type Rect } from './annotate';

export interface Profile {
  name: 'desktop' | 'mobile';
  width: number;
  height: number;
  mobile: boolean;
  captionFontSize: number;
  captionMarginX: number;
  captionMarginV: number;
}

export const PROFILES: Record<Profile['name'], Profile> = {
  desktop: {
    name: 'desktop',
    width: 1280,
    height: 720,
    mobile: false,
    captionFontSize: 34,
    captionMarginX: 96,
    captionMarginV: 44,
  },
  mobile: {
    name: 'mobile',
    width: 390,
    height: 844,
    mobile: true,
    captionFontSize: 22,
    captionMarginX: 24,
    captionMarginV: 64,
  },
};

declare global {
  interface Window {
    __kb: {
      glide(x: number, y: number, ms: number): Promise<boolean>;
      scrollIntoView(el: Element, ms: number, anchor?: number): Promise<boolean>;
      highlight(r: Rect, ms: number): void;
      redactAll(deep: boolean): void;
      annotate(shapes: unknown[], size: number): void;
    };
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Slow, deliberate actions on a page. All motion is eased in the page so the screen recording looks smooth. */
export class Session {
  constructor(
    readonly page: Page,
    readonly profile: Profile,
    private readonly shotsDir: string | null,
    private readonly pace = 1,
  ) {}

  pause(ms: number): Promise<void> {
    return sleep(ms * this.pace);
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'load' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.pause(500);
  }

  /** Smoothly scrolls so the element sits about a third of the way down its scroll area. */
  async reveal(target: Locator, anchor = 0.35): Promise<void> {
    await target.waitFor({ state: 'visible' });
    const moved = await target.evaluate((el, a) => window.__kb.scrollIntoView(el, 900, a), anchor);
    if (moved) await this.pause(300);
  }

  private async centre(target: Locator): Promise<{ x: number; y: number; box: Rect }> {
    const box = await target.boundingBox();
    if (!box) throw new Error('Target has no box');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  }

  async glide(target: Locator, ms = 800): Promise<Rect> {
    const { x, y, box } = await this.centre(target);
    await this.page.evaluate(
      ([gx, gy, gms]) => window.__kb.glide(gx!, gy!, gms!),
      [x, y, ms * this.pace],
    );
    await this.page.mouse.move(x, y);
    return box;
  }

  async point(target: Locator): Promise<void> {
    await this.reveal(target);
    await this.glide(target);
    await this.pause(400);
  }

  async click(target: Locator): Promise<void> {
    await this.reveal(target);
    const box = await this.glide(target);
    await this.page.evaluate((r) => window.__kb.highlight(r, 900), box);
    await this.pause(450);
    await this.page.mouse.down();
    await this.pause(90);
    await this.page.mouse.up();
    await this.pause(500);
  }

  async type(target: Locator, text: string, delay = 85): Promise<void> {
    await this.click(target);
    await target.pressSequentially(text, { delay: delay * this.pace });
    await this.pause(350);
  }

  /** A numbered screenshot with circles and arrows, written to the shots directory. Emails are redacted first. */
  async shot(
    name: string,
    marks: Array<{ target: Locator; label?: string }>,
  ): Promise<string | null> {
    if (!this.shotsDir) return null;
    const view = { width: this.profile.width, height: this.profile.height };
    await this.page.evaluate(() => window.__kb.redactAll(true));
    const boxes: Array<{ n: number; rect: Rect; label?: string }> = [];
    for (const [i, m] of marks.entries()) {
      await this.reveal(m.target, 0.4);
      const rect = await m.target.boundingBox();
      if (rect) boxes.push({ n: i + 1, rect, label: m.label });
    }
    const SIZE = 30;
    const shapes = boxes.map((b) => {
      const badge = placeBadge(b.rect, view, SIZE);
      return { ...b, badge, arrow: arrowFor(badge, b.rect, SIZE) };
    });
    await this.page.evaluate((a) => window.__kb.annotate(a.shapes, a.size), { shapes, size: SIZE });
    const file = `${this.shotsDir}/${name}.png`;
    await this.page.screenshot({ path: file });
    await this.page.evaluate(() => document.getElementById('__kb-annot')?.remove());
    return file;
  }
}
