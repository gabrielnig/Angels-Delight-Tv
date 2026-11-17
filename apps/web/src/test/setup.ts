import { afterEach } from 'vitest';

// Component tests opt in with the jsdom docblock. Plain node tests skip the DOM helpers.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  await import('@testing-library/jest-dom/vitest');
  afterEach(() => cleanup());

  // jsdom has no modal dialog support. Minimal stand in so dialogs open and close in tests.
  const proto = HTMLDialogElement.prototype;
  proto.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
