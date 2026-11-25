import { EMAIL_PATTERN, FAKE_DOMAIN_PATTERN, REDACTED } from './redact';

/**
 * Browser side helpers injected into every page of a recording context: a visible cursor, a click ripple, a highlight
 * box, eased cursor glides and scrolling, an email redactor and a mask for the Next.js dev badge.
 * Kept as plain JavaScript text on purpose: a function serialised from TypeScript can pull in bundler helpers that do
 * not exist in the page.
 */
export function overlayInitScript(o: { touch: boolean }): string {
  return `(() => {
  if (window.__kb) return;
  const OPTS = ${JSON.stringify({ touch: o.touch, emailPattern: EMAIL_PATTERN, fakePattern: FAKE_DOMAIN_PATTERN, redacted: REDACTED })};
  const isFake = (d) => new RegExp(OPTS.fakePattern, 'i').test(d.trim());
  const emailRe = () => new RegExp(OPTS.emailPattern, 'g');
  const redact = (t) => t.replace(emailRe(), (m) => (isFake(m.slice(m.lastIndexOf('@') + 1)) ? m : OPTS.redacted));
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  let cursor, pos = null;

  const css = document.createElement('style');
  css.textContent = [
    'nextjs-portal, #__next-build-watcher, [data-nextjs-toast], [data-nextjs-dev-tools-button] { display: none !important; }',
    '.__kb-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; will-change: transform; filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }',
    '.__kb-ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%; border: 3px solid #ffb400; background: rgba(255,180,0,.25); animation: __kb-ripple 650ms ease-out forwards; }',
    '@keyframes __kb-ripple { from { transform: scale(.4); opacity: 1; } to { transform: scale(3.2); opacity: 0; } }',
    '.__kb-hl { position: fixed; z-index: 2147483645; pointer-events: none; border: 3px solid #ffb400; border-radius: 10px; box-shadow: 0 0 0 6px rgba(255,180,0,.28); transition: opacity 250ms; }',
    'html { scroll-behavior: auto !important; }',
  ].join('\\n');

  function ensure() {
    if (cursor && cursor.isConnected) return;
    document.documentElement.appendChild(css);
    cursor = document.createElement('div');
    cursor.className = '__kb-cursor';
    cursor.style.opacity = '0';
    cursor.innerHTML = OPTS.touch
      ? '<svg width="44" height="44" viewBox="0 0 44 44" style="margin:-22px 0 0 -22px"><circle cx="22" cy="22" r="16" fill="rgba(255,255,255,.55)" stroke="#222" stroke-width="2"/></svg>'
      : '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M3 2 L3 21 L8 16.5 L11.5 24 L15 22.5 L11.6 15 L18.5 15 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(cursor);
    if (!pos) {
      try { pos = JSON.parse(sessionStorage.getItem('__kbpos') || 'null'); } catch (e) { pos = null; }
    }
    if (pos) place(pos.x, pos.y);
  }
  function place(x, y) {
    pos = { x, y };
    cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    cursor.style.opacity = '1';
    try { sessionStorage.setItem('__kbpos', JSON.stringify(pos)); } catch (e) {}
  }
  function ripple(x, y) {
    const r = document.createElement('div');
    r.className = '__kb-ripple';
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    r.addEventListener('animationend', () => r.remove());
    document.documentElement.appendChild(r);
  }
  function scrollParent(el) {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
    }
    return document.scrollingElement || document.documentElement;
  }
  function textNodes(root, fn) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = w.nextNode(); n; n = w.nextNode()) fn(n);
  }
  function redactAll(deep) {
    textNodes(document.documentElement, (n) => {
      if (emailRe().test(n.nodeValue)) { const v = redact(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
    });
    if (deep) {
      for (const i of document.querySelectorAll('input, textarea')) {
        if (i === document.activeElement) continue;
        if (i.type !== 'password' && emailRe().test(i.value)) i.value = redact(i.value);
      }
    }
  }
  let queued = false;
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; redactAll(false); }); } };

  window.__kb = {
    glide(x, y, ms) {
      ensure();
      if (!pos) place(innerWidth / 2, innerHeight * 0.9);
      const sx = pos.x, sy = pos.y, t0 = performance.now();
      return new Promise((res) => {
        const f = (t) => {
          const k = Math.min(1, (t - t0) / ms), e = ease(k);
          place(sx + (x - sx) * e, sy + (y - sy) * e);
          if (k < 1) requestAnimationFrame(f); else res(true);
        };
        requestAnimationFrame(f);
      });
    },
    scrollIntoView(el, ms, anchor) {
      const sp = scrollParent(el);
      const box = sp === document.scrollingElement || sp === document.documentElement ? { top: 0, height: innerHeight } : sp.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      // Already comfortably on screen: leave the page where it is so the recording does not jump.
      if (r.top >= box.top + box.height * 0.08 && r.bottom <= box.top + box.height * 0.85) return Promise.resolve(false);
      const want = box.top + box.height * (anchor == null ? 0.35 : anchor);
      const from = sp.scrollTop, to = Math.max(0, Math.min(from + (r.top - want), sp.scrollHeight - sp.clientHeight));
      if (Math.abs(to - from) < 2) return Promise.resolve(false);
      const t0 = performance.now();
      return new Promise((res) => {
        const f = (t) => {
          const k = Math.min(1, (t - t0) / ms);
          sp.scrollTop = from + (to - from) * ease(k);
          if (k < 1) requestAnimationFrame(f); else res(true);
        };
        requestAnimationFrame(f);
      });
    },
    highlight(r, ms) {
      const h = document.createElement('div');
      h.className = '__kb-hl';
      Object.assign(h.style, { left: r.x - 6 + 'px', top: r.y - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
      document.documentElement.appendChild(h);
      setTimeout(() => { h.style.opacity = '0'; setTimeout(() => h.remove(), 260); }, ms);
    },
    redactAll,
    annotate(sh, size) {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.id = '__kb-annot';
      svg.setAttribute('style', 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483644;pointer-events:none');
      const add = (tag, attrs, text) => {
        const e = document.createElementNS(NS, tag);
        for (const k of Object.keys(attrs)) e.setAttribute(k, String(attrs[k]));
        if (text) e.textContent = text;
        svg.appendChild(e);
      };
      for (const s of sh) {
        add('rect', { x: s.rect.x - 4, y: s.rect.y - 4, width: s.rect.width + 8, height: s.rect.height + 8, rx: 8, fill: 'none', stroke: '#e11d48', 'stroke-width': 3 });
        if (s.arrow) add('line', { x1: s.arrow.from.x, y1: s.arrow.from.y, x2: s.arrow.to.x, y2: s.arrow.to.y, stroke: '#e11d48', 'stroke-width': 3, 'stroke-linecap': 'round' });
        add('circle', { cx: s.badge.x + size / 2, cy: s.badge.y + size / 2, r: size / 2, fill: '#e11d48', stroke: '#fff', 'stroke-width': 2 });
        add('text', { x: s.badge.x + size / 2, y: s.badge.y + size / 2 + 6, 'text-anchor': 'middle', 'font-family': 'Inter, Arial, sans-serif', 'font-size': 17, 'font-weight': 700, fill: '#fff' }, String(s.n));
      }
      document.documentElement.appendChild(svg);
    },
  };

  addEventListener('mousemove', (e) => { ensure(); place(e.clientX, e.clientY); }, true);
  addEventListener('mousedown', (e) => { ensure(); place(e.clientX, e.clientY); ripple(e.clientX, e.clientY); }, true);
  const start = () => {
    ensure();
    redactAll(false);
    new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();`;
}
