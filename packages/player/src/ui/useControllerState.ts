'use client';

import { useSyncExternalStore } from 'react';
import type { PlayerController } from '../controller';
import { buildQualityMenu } from '../quality';
import type { PlayerState } from '../types';

export const IDLE_STATE: PlayerState = {
  phase: 'loading',
  playing: false,
  buffering: false,
  slowNotice: false,
  error: null,
  currentTime: 0,
  duration: Number.NaN,
  bufferedEnd: 0,
  volume: 1,
  muted: false,
  rate: 1,
  captions: { available: false, tracks: [], active: null },
  quality: {
    menu: buildQualityMenu({
      heights: [],
      selected: 'auto',
      currentHeight: null,
      dataSaver: false,
      dataSaverMaxHeight: 360,
    }),
    selected: 'auto',
    currentHeight: null,
    dataSaver: false,
  },
  toast: null,
  upNext: { tile: false, countdown: null, cancelled: false, stillWatching: false },
  hasAudio: true,
  backOnline: false,
  marker: null,
  chapter: null,
  autoplayNext: false,
  hint: null,
  wireless: false,
  retries: 0,
  announce: '',
};

const noop = () => () => undefined;
const idle = () => IDLE_STATE;

/** Subscribe a component to a controller that may not exist yet. */
export function useControllerState(controller: PlayerController | null): PlayerState {
  return useSyncExternalStore(
    controller ? controller.subscribe : noop,
    controller ? controller.getState : idle,
    idle,
  );
}
