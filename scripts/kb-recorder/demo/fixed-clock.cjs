'use strict';
/* global process */
/**
 * Preload for the demo web server: `NODE_OPTIONS="--require ./scripts/kb-recorder/demo/fixed-clock.cjs"` with
 * KB_DEMO_NOW=<ISO time>. Freezes Date.now() and new Date() so every server rendered date and "x minutes ago" label
 * is the same in every recording. Timers are not affected. Never set this on a real server.
 */
const raw = process.env.KB_DEMO_NOW;
if (raw) {
  const fixed = Date.parse(raw);
  if (Number.isNaN(fixed)) {
    process.stderr.write('KB_DEMO_NOW must be an ISO date time, got "' + raw + '"\n');
    process.exit(1);
  }
  const RealDate = Date;
  function FixedDate(...args) {
    if (!new.target) return new RealDate(fixed).toString();
    return args.length === 0 ? new RealDate(fixed) : new RealDate(...args);
  }
  FixedDate.prototype = RealDate.prototype;
  FixedDate.now = () => fixed;
  FixedDate.parse = RealDate.parse;
  FixedDate.UTC = RealDate.UTC;
  Object.setPrototypeOf(FixedDate, RealDate);
  globalThis.Date = FixedDate;
}
