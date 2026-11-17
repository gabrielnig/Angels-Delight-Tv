import { RateLimited } from '@ad/shared';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAdminBudget } from './budget';

describe('admin budget', () => {
  it('spends the adminGeneral bucket for the staff account and throws RateLimited when empty', async () => {
    const calls: string[] = [];
    const budget = createAdminBudget(async (policy, subject) => {
      calls.push(`${policy.name}:${subject}`);
      return { allowed: false, retryAfterSeconds: 12 };
    });
    await expect(budget.spend('acc-1')).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 12,
    });
    await expect(budget.spend('acc-1')).rejects.toBeInstanceOf(RateLimited);
    expect(calls[0]).toBe('admin-general:acc-1');
  });

  it('lets a request through while budget remains', async () => {
    const budget = createAdminBudget(async () => ({ allowed: true, retryAfterSeconds: 0 }));
    await expect(budget.spend('acc-1')).resolves.toBeUndefined();
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === 'actions.ts' || name === 'session-actions.ts') out.push(p);
  }
  return out;
}

describe('every admin server action file', () => {
  const files = walk(join(__dirname, '../../app/admin')).filter((f) => !f.includes('/login/') && !f.includes('/invite/'));
  it('finds the action files', () => expect(files.length).toBeGreaterThan(8));
  for (const file of files) {
    it(`${file.split('/app/')[1]} resolves its actor through the budgeted helper`, () => {
      const src = readFileSync(file, 'utf8');
      const uses = /\brequireActor\(/.test(src);
      expect(uses, 'use requireActionActor so the per staff limit applies').toBe(false);
    });
  }
});
