import {
  Conflict,
  Forbidden,
  NotFound,
  RateLimited,
  Unauthorized,
  ValidationFailed,
} from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { errorResponse, jsonResponse, readJson } from './respond';

describe('errorResponse', () => {
  it('maps app errors to their status with a stable body and no caching', async () => {
    const response = errorResponse(new NotFound('Upload not found'));
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: { code: 'not_found', message: 'Upload not found' },
    });
  });
  it('includes field messages for validation failures', async () => {
    const response = errorResponse(new ValidationFailed({ size: ['Too big'] }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: 'validation_failed', fields: { size: ['Too big'] } },
    });
  });
  it('adds Retry-After for rate limits', () => {
    const response = errorResponse(new RateLimited(12));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('12');
  });
  it('maps auth errors', () => {
    expect(errorResponse(new Unauthorized()).status).toBe(401);
    expect(errorResponse(new Forbidden()).status).toBe(403);
    expect(errorResponse(new Conflict('x')).status).toBe(409);
  });
  it('hides unknown errors behind a generic 500 and reports them to the logger', async () => {
    const seen: unknown[] = [];
    const response = errorResponse(new Error('db password is hunter2'), (error) =>
      seen.push(error),
    );
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('hunter2');
    expect(seen).toHaveLength(1);
  });
  it('carries extra fields from errors that expose them', async () => {
    const error = Object.assign(new Conflict('Parts missing'), { missing: [2] });
    expect(await errorResponse(error).json()).toMatchObject({ error: { missing: [2] } });
  });
});

describe('jsonResponse and readJson', () => {
  it('sets json content type and no-store', () => {
    const response = jsonResponse({ ok: true }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects invalid json and oversized bodies as validation failures', async () => {
    const bad = new Request('http://x/', { method: 'POST', body: '{nope' });
    await expect(readJson(bad)).rejects.toBeInstanceOf(ValidationFailed);
    const big = new Request('http://x/', {
      method: 'POST',
      body: JSON.stringify({ a: 'x'.repeat(70_000) }),
    });
    await expect(readJson(big)).rejects.toBeInstanceOf(ValidationFailed);
  });
  it('parses a valid body', async () => {
    const ok = new Request('http://x/', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    expect(await readJson(ok)).toEqual({ a: 1 });
  });
});
