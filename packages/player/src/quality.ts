export interface NetworkHints {
  saveData?: boolean;
  effectiveType?: string;
  /** Estimated Mbps from the Network Information API. */
  downlink?: number;
}

const SLOW_TYPES = new Set(['slow-2g', '2g', '3g']);
const SLOW_DOWNLINK_MBPS = 1.5;

/** M25 low-data defaults: Save-Data header or a slow effective connection type. */
export function detectLowData(hints: NetworkHints | undefined | null): boolean {
  if (!hints) return false;
  if (hints.saveData) return true;
  if (hints.effectiveType !== undefined && SLOW_TYPES.has(hints.effectiveType)) return true;
  return hints.downlink !== undefined && hints.downlink > 0 && hints.downlink < SLOW_DOWNLINK_MBPS;
}

/** Read hints from the Network Information API where it exists. */
export function readNetworkHints(
  nav: unknown = typeof navigator === 'undefined' ? undefined : navigator,
): NetworkHints {
  const conn = (
    nav as
      | { connection?: { saveData?: boolean; effectiveType?: string; downlink?: number } }
      | undefined
  )?.connection;
  const hints: NetworkHints = {};
  if (conn?.saveData !== undefined) hints.saveData = conn.saveData;
  if (conn?.effectiveType !== undefined) hints.effectiveType = conn.effectiveType;
  if (typeof conn?.downlink === 'number') hints.downlink = conn.downlink;
  return hints;
}

export interface StartHeightOptions {
  lowData: boolean;
  cap?: number | null;
}

/**
 * First rendition to load: 360p on low data, 480p otherwise, never above the cap.
 * When the ladder has no rung at or below the target, the lowest rung is used.
 */
export function pickStartHeight(
  heights: readonly number[],
  opts: StartHeightOptions,
): number | null {
  const sorted = [...new Set(heights)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const target = Math.min(opts.lowData ? 360 : 480, opts.cap ?? Infinity);
  const atOrBelow = sorted.filter((h) => h <= target);
  if (atOrBelow.length > 0) return atOrBelow[atOrBelow.length - 1] ?? null;
  return sorted[0] ?? null;
}

export function effectiveCap(opts: {
  dataSaver: boolean;
  dataSaverMaxHeight: number;
}): number | null {
  return opts.dataSaver ? opts.dataSaverMaxHeight : null;
}

export type QualitySelection = 'auto' | number;

export interface QualityState {
  heights: readonly number[];
  selected: QualitySelection;
  currentHeight: number | null;
  dataSaver: boolean;
  dataSaverMaxHeight: number;
}

export interface QualityItem {
  id: string;
  label: string;
  detail?: string;
  selected: boolean;
  disabled: boolean;
  hint?: string;
}

export interface QualityMenu {
  visible: boolean;
  buttonLabel: string;
  items: QualityItem[];
}

export const DATA_SAVER_HINT = 'Turn off Data saver to use higher quality';

/** M08-S11: Auto plus the renditions that exist, high to low, disabled with a hint under Data saver. */
export function buildQualityMenu(state: QualityState): QualityMenu {
  const heights = [...new Set(state.heights)].sort((a, b) => b - a);
  const cap = effectiveCap(state);
  const auto: QualityItem = {
    id: 'auto',
    label: 'Auto',
    selected: state.selected === 'auto',
    disabled: false,
  };
  if (state.currentHeight !== null) auto.detail = `${state.currentHeight}p now`;
  const items: QualityItem[] = [auto];
  for (const h of heights) {
    const blocked = cap !== null && h > cap;
    const item: QualityItem = {
      id: String(h),
      label: `${h}p`,
      selected: state.selected === h,
      disabled: blocked,
    };
    if (blocked) item.hint = DATA_SAVER_HINT;
    items.push(item);
  }
  return {
    visible: heights.length > 1,
    buttonLabel: state.selected === 'auto' ? 'Auto' : `${state.selected}p`,
    items,
  };
}
