import { isSponsorSlot, type SponsorSlot } from '@ad/shared';

/** The slice of IntersectionObserver the tracker uses, so it runs under test without a browser. */
export interface ObserverLike {
  observe(element: HTMLElement): void;
  disconnect(): void;
}
type ObserverEntry = { isIntersecting: boolean; intersectionRatio: number };

export interface SponsorTrackerDeps {
  send(event: { kind: 'sponsor_impression'; creativeId: string; slot: SponsorSlot; impressionId: string }): void;
  createObserver(
    callback: (entries: ObserverEntry[]) => void,
    options: { threshold: number },
  ): ObserverLike;
  isHidden(): boolean;
  newId(): string;
  /** Kids mode: the tracker does nothing at all. */
  kids: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const IMPRESSION_VISIBLE_MS = 1000;

/**
 * A viewable impression is 50 percent of the card in view for one second with the tab visible (M48-S15). One event
 * per card per page view. The element carries `data-creative` and `data-slot`. No network request is made here: the
 * event joins the normal analytics batch.
 */
export function createSponsorTracker(deps: SponsorTrackerDeps) {
  return {
    track(element: HTMLElement): void {
      if (deps.kids) return;
      const creativeId = element.dataset.creative;
      const slot = element.dataset.slot;
      if (!creativeId || !UUID.test(creativeId) || !slot || !isSponsorSlot(slot)) return;

      let timer: ReturnType<typeof setTimeout> | undefined;
      let done = false;
      const observer = deps.createObserver(
        (entries) => {
          if (done) return;
          const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
          if (!visible) {
            if (timer) clearTimeout(timer);
            timer = undefined;
            return;
          }
          if (timer || deps.isHidden()) return;
          timer = setTimeout(() => {
            timer = undefined;
            if (done || deps.isHidden()) return;
            done = true;
            observer.disconnect();
            deps.send({ kind: 'sponsor_impression', creativeId, slot, impressionId: deps.newId() });
          }, IMPRESSION_VISIBLE_MS);
        },
        { threshold: 0.5 },
      );
      observer.observe(element);
    },
  };
}
