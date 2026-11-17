import { describe, expect, it } from 'vitest';
import { isEditableTarget, resolveShortcut, SHORTCUT_HELP } from './keyboard';

const key = (k: string, extra: Partial<Parameters<typeof resolveShortcut>[0]> = {}) =>
  resolveShortcut({ key: k, ...extra }, { hasNext: true });

describe('resolveShortcut', () => {
  it('maps play and pause', () => {
    expect(key(' ')).toEqual({ type: 'toggle-play' });
    expect(key('k')).toEqual({ type: 'toggle-play' });
    expect(key('K')).toEqual({ type: 'toggle-play' });
  });
  it('maps seeking', () => {
    expect(key('ArrowLeft')).toEqual({ type: 'seek-by', seconds: -5 });
    expect(key('ArrowRight')).toEqual({ type: 'seek-by', seconds: 5 });
    expect(key('j')).toEqual({ type: 'seek-by', seconds: -10 });
    expect(key('l')).toEqual({ type: 'seek-by', seconds: 10 });
    expect(key('Home')).toEqual({ type: 'seek-start' });
    expect(key('End')).toEqual({ type: 'seek-end' });
  });
  it('maps volume in 5 percent steps', () => {
    expect(key('ArrowUp')).toEqual({ type: 'volume-by', delta: 0.05 });
    expect(key('ArrowDown')).toEqual({ type: 'volume-by', delta: -0.05 });
  });
  it('maps single toggles', () => {
    expect(key('m')).toEqual({ type: 'toggle-mute' });
    expect(key('c')).toEqual({ type: 'toggle-captions' });
    expect(key('f')).toEqual({ type: 'toggle-fullscreen' });
    expect(key('?')).toEqual({ type: 'help' });
  });
  it('maps digits to 0 to 90 percent', () => {
    expect(key('0')).toEqual({ type: 'seek-fraction', fraction: 0 });
    expect(key('5')).toEqual({ type: 'seek-fraction', fraction: 0.5 });
    expect(key('9')).toEqual({ type: 'seek-fraction', fraction: 0.9 });
  });
  it('maps shift comma and period to speed steps', () => {
    expect(key('<', { shiftKey: true })).toEqual({ type: 'speed-step', direction: -1 });
    expect(key('>', { shiftKey: true })).toEqual({ type: 'speed-step', direction: 1 });
    expect(key(',', { shiftKey: true, code: 'Comma' })).toEqual({
      type: 'speed-step',
      direction: -1,
    });
    expect(key('.', { shiftKey: true, code: 'Period' })).toEqual({
      type: 'speed-step',
      direction: 1,
    });
  });
  it('maps N to next only when a next title exists', () => {
    expect(key('n')).toEqual({ type: 'next' });
    expect(resolveShortcut({ key: 'n' }, { hasNext: false })).toBeNull();
  });
  it('ignores unmodified comma and unknown keys', () => {
    expect(key(',')).toBeNull();
    expect(key('q')).toBeNull();
  });
  it('ignores browser and screen reader chords', () => {
    expect(key('k', { ctrlKey: true })).toBeNull();
    expect(key('f', { metaKey: true })).toBeNull();
    expect(key('m', { altKey: true })).toBeNull();
  });
  it('ignores events from editable targets', () => {
    const input = document.createElement('input');
    expect(resolveShortcut({ key: 'k', target: input }, { hasNext: true })).toBeNull();
  });
});

describe('isEditableTarget', () => {
  it('detects inputs, textareas, selects and contenteditable', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(document.createElement('select'))).toBe(true);
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(div)).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('SHORTCUT_HELP', () => {
  it('covers every group shown in the S26 dialog', () => {
    const actions = SHORTCUT_HELP.map((r) => r.action);
    expect(actions).toContain('Play or pause');
    expect(actions).toContain('Open this list');
    expect(SHORTCUT_HELP.every((r) => r.keys.length > 0)).toBe(true);
  });
});
