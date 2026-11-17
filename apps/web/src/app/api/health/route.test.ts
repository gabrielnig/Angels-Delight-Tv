import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
  it('answers 200 with a minimal body', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('is never cached, so a stale answer cannot hide a dead process', async () => {
    const response = await GET();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('says nothing about versions or configuration', async () => {
    const body = await (await GET()).json();
    expect(Object.keys(body)).toEqual(['status']);
  });
});
