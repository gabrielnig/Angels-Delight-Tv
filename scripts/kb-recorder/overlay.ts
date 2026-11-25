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
    scrollIntoView(el, ms, anchor, safeBottom) {
      const sp = scrollParent(el);
      const box = sp === document.scrollingElement || sp === document.documentElement ? { top: 0, height: innerHeight } : sp.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      // Already comfortably on screen: leave the page where it is so the recording does not jump.
      const limit = Math.min(box.top + box.height * 0.85, (sp === document.scrollingElement || sp === document.documentElement ? innerHeight : box.top + box.height) - (safeBottom || 0));
      if (r.top >= box.top + box.height * 0.08 && r.bottom <= limit) return Promise.resolve(false);
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
    zoom(rect, scale, ms) {
      const root = document.documentElement;
      root.style.transformOrigin = '0 0';
      const from = root.__kbz || { s: 1, x: 0, y: 0 };
      const to = rect
        ? { s: scale, x: -(rect.x + rect.width / 2) * scale + innerWidth / 2, y: -(rect.y + rect.height / 2) * scale + innerHeight / 2 }
        : { s: 1, x: 0, y: 0 };
      // Keep the zoomed page covering the frame: never show empty space beyond the page edges.
      to.x = Math.min(0, Math.max(to.x, innerWidth - innerWidth * to.s));
      to.y = Math.min(0, Math.max(to.y, innerHeight - innerHeight * to.s));
      const t0 = performance.now();
      return new Promise((res) => {
        const f = (t) => {
          const k = Math.min(1, (t - t0) / ms), e = ease(k);
          const c = { s: from.s + (to.s - from.s) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
          root.style.transform = 'translate(' + c.x + 'px,' + c.y + 'px) scale(' + c.s + ')';
          root.__kbz = c;
          if (k < 1) requestAnimationFrame(f); else res(true);
        };
        requestAnimationFrame(f);
      });
    },
    redactAll,
    maskAll() {
      for (const el of Array.from(document.querySelectorAll('[data-kb-mask]'))) {
        el.textContent = 'DEMO-0000-0000';
      }
    },
    annotate(sh) {
      const NS = 'http://www.w3.org/2000/svg';
      const root = document.createElement('div');
      root.id = '__kb-annot';
      root.setAttribute('style', 'position:fixed;inset:0;z-index:2147483644;pointer-events:none');
      for (const b of sh.blurs) {
        const d = document.createElement('div');
        d.setAttribute('style', 'position:fixed;left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.width + 'px;height:' + b.height + 'px;backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);background:rgba(255,255,255,.35);border-radius:6px');
        root.appendChild(d);
      }
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%');
      const add = (tag, attrs, text) => {
        const e = document.createElementNS(NS, tag);
        for (const k of Object.keys(attrs)) e.setAttribute(k, String(attrs[k]));
        if (text) e.textContent = text;
        svg.appendChild(e);
      };
      // Fixed annotation colours (not theme tokens): they must not change when the client changes the theme.
      for (const r of sh.highlights) {
        add('rect', { x: r.x - 5, y: r.y - 5, width: r.width + 10, height: r.height + 10, rx: 9, fill: 'none', stroke: '#1b1b1f', 'stroke-width': 5 });
        add('rect', { x: r.x - 5, y: r.y - 5, width: r.width + 10, height: r.height + 10, rx: 9, fill: 'none', stroke: '#ffb400', 'stroke-width': 3 });
      }
      for (const a of sh.arrows) {
        add('line', { x1: a.from.x, y1: a.from.y, x2: a.to.x, y2: a.to.y, stroke: '#1b1b1f', 'stroke-width': 5, 'stroke-linecap': 'round' });
        add('line', { x1: a.from.x, y1: a.from.y, x2: a.to.x, y2: a.to.y, stroke: '#ffb400', 'stroke-width': 3, 'stroke-linecap': 'round' });
      }
      for (const b of sh.badges) {
        const cx = b.x + b.size / 2, cy = b.y + b.size / 2;
        add('circle', { cx, cy, r: b.size / 2, fill: '#1b1b1f', stroke: '#ffb400', 'stroke-width': 2 });
        add('text', { x: cx, y: cy + 6, 'text-anchor': 'middle', 'font-family': 'Inter, Arial, sans-serif', 'font-size': 16, 'font-weight': 700, fill: '#fff' }, String(b.n));
      }
      root.appendChild(svg);
      document.documentElement.appendChild(root);
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
