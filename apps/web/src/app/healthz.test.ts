import { describe, expect, it } from 'vitest';
import { GET as healthz } from './healthz/route';
import { GET as health } from './api/health/route';

describe('/healthz alias', () => {
  it('answers like /api/health', async () => {
    const a = await healthz();
    const b = await health();
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual(await b.json());
    expect(a.headers.get('cache-control')).toBe('no-store');
  });
});

describe('/readyz alias', () => {
  it('is the same handler as /api/ready', async () => {
    const [{ GET: readyz }, { GET: ready }] = await Promise.all([
      import('./readyz/route'),
      import('./api/ready/route'),
    ]);
    expect(readyz).toBe(ready);
  });
});
