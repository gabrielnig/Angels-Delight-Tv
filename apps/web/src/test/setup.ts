import { afterEach } from 'vitest';

// Component tests opt in with the jsdom docblock. Plain node tests skip the DOM helpers.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  await import('@testing-library/jest-dom/vitest');
  afterEach(() => cleanup());
}
