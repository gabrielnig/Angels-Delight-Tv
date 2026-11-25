/// <reference lib="dom" />
import type { Locator, Page } from '@playwright/test';
import type { Rect } from './annotate';
import { assertPageClean } from './scan-page';
import { cropRect, planShapes, type MarkInput } from './shapes';
import type { Profile } from './profiles';
import { captionBand, captionPlacement, type Band } from './safe-area';

export { PROFILES, type Profile } from './profiles';

declare global {
  interface Window {
    __kb: {
      glide(x: number, y: number, ms: number): Promise<boolean>;
      scrollIntoView(
        el: Element,
        ms: number,
        anchor?: number,
        safeBottom?: number,
      ): Promise<boolean>;
      zoom(rect: Rect | null, scale: number, ms: number): Promise<boolean>;
      highlight(r: Rect, ms: number): void;
      redactAll(deep: boolean): void;
      annotate(shapes: unknown): void;
      maskAll(): void;
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
  ) {
    this.band = captionBand(profile);
  }

  /** Multiply a motion time by this so slow runs stay slow and locator runs stay quick. */
  get paceFactor(): number {
    return this.pace;
  }

  /** Where the burned in caption can sit, so a target is never scrolled under it. */
  readonly band: Band;
  /** The box of the last element the viewer was pointed at, used to choose the caption side. */
  lastTarget: Rect | null = null;
  /** The name of the control the pointer last went to, for the transcript. */
  lastTargetName: string | null = null;
  /** Waits cut out of the video, as wall clock times (ms since epoch). The runner converts them to the video clock. */
  readonly skips: Array<{ startAt: number; endAt: number }> = [];

  /** Which side the caption of the step just played should use. */
  captionSide(): 'top' | 'bottom' {
    if (!this.lastTarget) return 'bottom';
    return captionPlacement(this.lastTarget, this.profile, this.band);
  }

  /**
   * Runs a long wait (an upload, an encode) and cuts the dead time out of the video, keeping 0.6 s on each side. The
   * video shows a "Time skipped" badge at the cut. Waits under 1.5 s are left alone.
   */
  async skippable<T>(wait: () => Promise<T>): Promise<T> {
    const startAt = Date.now();
    const result = await wait();
    const endAt = Date.now();
    if (endAt - startAt > 1500 + 1200)
      this.skips.push({ startAt: startAt + 600, endAt: endAt - 600 });
    return result;
  }

  pause(ms: number): Promise<void> {
    return sleep(ms * this.pace);
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'load' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.pause(500);
    await this.guard(`page ${path}`);
  }

  /** Smoothly scrolls so the element sits about a third of the way down its scroll area. */
  async reveal(target: Locator, anchor = 0.35): Promise<void> {
    await target.waitFor({ state: 'visible' });
    const safe = this.band.bottom;
    const moved = await target.evaluate((el, [a, b]) => window.__kb.scrollIntoView(el, 900, a, b), [
      anchor,
      safe,
    ] as [number, number]);
    if (moved) await this.pause(300);
  }

  private async centre(target: Locator): Promise<{ x: number; y: number; box: Rect }> {
    const box = await target.boundingBox();
    if (!box) throw new Error('Target has no box');
    this.lastTarget = box;
    this.lastTargetName = await target
      .evaluate((el) =>
        (el.getAttribute('aria-label') || el.textContent || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 60),
      )
      .catch(() => null);
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
    await this.guard('after a click');
  }

  async type(target: Locator, text: string, delay = 85): Promise<void> {
    await this.click(target);
    await target.pressSequentially(text, { delay: delay * this.pace });
    await this.pause(350);
  }

  /** Fails the capture when the page shows real looking data (scan.ts). Runs after navigation, clicks and every step. */
  async guard(where: string): Promise<void> {
    if (this.scanAllow === null) return;
    await assertPageClean(this.page, where, { allow: this.scanAllow });
  }

  /** Values the scanner may ignore, for example one fake phone number a screen must show. Null turns the scan off. */
  scanAllow: string[] | null = [];

  /**
   * A numbered, annotated screenshot written to the shots directory as PNG (the runner converts it to WebP).
   * The scanner runs first, so a capture with real looking data fails instead of being saved.
   */
  async shot(
    name: string,
    spec: {
      marks: Array<{ target: Locator; label?: string; kind?: 'mark' | 'blur'; arrow?: boolean }>;
      crop?: Locator;
      scheme?: 'light' | 'dark';
    },
  ): Promise<string | null> {
    if (!this.shotsDir) return null;
    const view = { width: this.profile.width, height: this.profile.height };
    await this.page.evaluate(() => {
      window.__kb.maskAll();
      window.__kb.redactAll(true);
    });
    await this.guard(`screenshot ${name}`);
    const inputs: MarkInput[] = [];
    for (const m of spec.marks) {
      if (m.kind !== 'blur') await this.reveal(m.target, 0.4);
      const rect = await m.target.boundingBox();
      if (rect) inputs.push({ rect, kind: m.kind, arrow: m.arrow });
    }
    const shapes = planShapes(inputs, view);
    let clip: Rect | undefined;
    if (spec.crop) {
      await this.reveal(spec.crop, 0.3);
      const box = await spec.crop.boundingBox();
      if (box) clip = cropRect(box, view, 16, { minWidth: view.width / 3, minHeight: 160 });
    }
    if (spec.scheme) await this.page.emulateMedia({ colorScheme: spec.scheme });
    await this.page.evaluate((s) => window.__kb.annotate(s), shapes);
    const file = `${this.shotsDir}/${name}.png`;
    await this.page.screenshot({
      path: file,
      ...(clip ? { clip } : {}),
      animations: 'disabled',
      caret: 'hide',
    });
    await this.page.evaluate(() => document.getElementById('__kb-annot')?.remove());
    if (spec.scheme) await this.page.emulateMedia({ colorScheme: 'light' });
    return file;
  }
}
