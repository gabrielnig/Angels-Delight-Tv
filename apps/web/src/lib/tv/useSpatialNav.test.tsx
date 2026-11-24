// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpatialNav } from './useSpatialNav';

function Probe({ enabled }: { enabled: boolean }) {
  useSpatialNav({ enabled });
  return null;
}

function place(el: HTMLElement, left: number, top: number, w = 100, h = 100) {
  el.getBoundingClientRect = () =>
    ({
      left,
      top,
      right: left + w,
      bottom: top + h,
      width: w,
      height: h,
      x: left,
      y: top,
      toJSON() {},
    }) as DOMRect;
  el.scrollIntoView = vi.fn();
}

function layout(html: string) {
  document.body.innerHTML = html;
  const byId = (id: string) => document.getElementById(id) as HTMLElement;
  return byId;
}

const key = (k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key: k, ...init });

describe('useSpatialNav', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('moves focus right and down with the arrows', () => {
    const $ = layout('<a id="a" href="/a">a</a><a id="b" href="/b">b</a><a id="c" href="/c">c</a>');
    place($('a'), 0, 0);
    place($('b'), 120, 0);
    place($('c'), 0, 120);
    render(<Probe enabled />);
    $('a').focus();
    key('ArrowRight');
    expect(document.activeElement).toBe($('b'));
    key('ArrowLeft');
    key('ArrowDown');
    expect(document.activeElement).toBe($('c'));
    expect($('c').scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'center' });
  });

  it('reaches a data-focusable div and Enter activates it', () => {
    const $ = layout('<button id="a">a</button><div id="t" data-focusable tabindex="0">tile</div>');
    place($('a'), 0, 0);
    place($('t'), 120, 0);
    const click = vi.fn();
    $('t').addEventListener('click', click);
    render(<Probe enabled />);
    $('a').focus();
    key('ArrowRight');
    expect(document.activeElement).toBe($('t'));
    key('Enter');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('leaves Enter alone on native controls', () => {
    const $ = layout('<button id="a">a</button>');
    place($('a'), 0, 0);
    const click = vi.fn();
    $('a').addEventListener('click', click);
    render(<Probe enabled />);
    $('a').focus();
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    $('a').dispatchEvent(ev);
    expect(click).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('skips hidden, disabled and aria-hidden elements', () => {
    const $ = layout(
      '<a id="a" href="/a">a</a>' +
        '<button id="d" disabled>d</button>' +
        '<a id="h" href="/h" hidden>h</a>' +
        '<a id="x" href="/x" aria-hidden="true">x</a>' +
        '<a id="z" href="/z">z</a>',
    );
    place($('a'), 0, 0);
    place($('d'), 120, 0);
    place($('h'), 240, 0);
    place($('x'), 360, 0);
    place($('z'), 480, 0);
    render(<Probe enabled />);
    $('a').focus();
    key('ArrowRight');
    expect(document.activeElement).toBe($('z'));
  });

  it('goes back on Escape, XF86Back and the TV back key codes', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    layout('<a id="a" href="/a">a</a>');
    render(<Probe enabled />);
    key('Escape');
    key('XF86Back');
    fireEvent.keyDown(document.body, { key: 'Unidentified', keyCode: 10009 });
    fireEvent.keyDown(document.body, { key: 'Unidentified', keyCode: 461 });
    expect(back).toHaveBeenCalledTimes(4);
  });

  it('does nothing when TV mode is off', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const $ = layout('<a id="a" href="/a">a</a><a id="b" href="/b">b</a>');
    place($('a'), 0, 0);
    place($('b'), 120, 0);
    render(<Probe enabled={false} />);
    $('a').focus();
    key('ArrowRight');
    key('Escape');
    expect(document.activeElement).toBe($('a'));
    expect(back).not.toHaveBeenCalled();
  });

  it('keeps Left and Right for the caret in a text field', () => {
    const $ = layout('<input id="q" type="search" /><a id="b" href="/b">b</a>');
    place($('q'), 0, 0);
    place($('b'), 120, 0);
    render(<Probe enabled />);
    $('q').focus();
    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    $('q').dispatchEvent(ev);
    expect(document.activeElement).toBe($('q'));
    expect(ev.defaultPrevented).toBe(false);
  });

  it('lets Up and Down leave a text field, and Escape blurs it instead of going back', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const $ = layout('<input id="q" type="search" /><a id="b" href="/b">b</a>');
    place($('q'), 0, 0);
    place($('b'), 0, 120);
    render(<Probe enabled />);
    $('q').focus();
    key('ArrowDown');
    expect(document.activeElement).toBe($('b'));
    $('q').focus();
    key('Escape');
    expect(document.activeElement).not.toBe($('q'));
    expect(back).not.toHaveBeenCalled();
  });

  it('ignores select elements so the native list works', () => {
    const $ = layout('<select id="s"><option>1</option></select><a id="b" href="/b">b</a>');
    place($('s'), 0, 0);
    place($('b'), 120, 0);
    render(<Probe enabled />);
    $('s').focus();
    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    $('s').dispatchEvent(ev);
    expect(document.activeElement).toBe($('s'));
    expect(ev.defaultPrevented).toBe(false);
  });

  it('does not prevent default at an edge, so the page can scroll', () => {
    const $ = layout('<a id="a" href="/a">a</a>');
    place($('a'), 0, 0);
    render(<Probe enabled />);
    $('a').focus();
    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    $('a').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('starts at the first control when nothing is focused', () => {
    const $ = layout('<a id="a" href="/a">a</a><a id="b" href="/b">b</a>');
    place($('a'), 0, 0);
    place($('b'), 120, 0);
    render(<Probe enabled />);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(document.activeElement).toBe($('a'));
  });

  it('stays inside an open modal dialog and leaves Escape to it', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const $ = layout(
      '<a id="out" href="/o">o</a>' +
        '<div role="dialog" aria-modal="true"><button id="in1">1</button><button id="in2">2</button></div>',
    );
    place($('out'), 0, 0);
    place($('in1'), 0, 300);
    place($('in2'), 120, 300);
    render(<Probe enabled />);
    $('in1').focus();
    key('ArrowUp');
    expect(document.activeElement).toBe($('in1'));
    key('ArrowRight');
    expect(document.activeElement).toBe($('in2'));
    key('Escape');
    expect(back).not.toHaveBeenCalled();
  });
});
