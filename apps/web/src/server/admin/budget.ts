import { RateLimited } from '@ad/shared';
import { RATE_POLICIES, type BucketPolicy } from '@ad/security';

type Consume = (
  policy: BucketPolicy,
  subject: string,
) => Promise<{ allowed: boolean; retryAfterSeconds: number }>;

/** One shared per staff account budget for admin routes and server actions (M-6, L-10). */
export function createAdminBudget(consume: Consume) {
  return {
    async spend(accountId: string): Promise<void> {
      const result = await consume(RATE_POLICIES.adminGeneral, accountId);
      if (!result.allowed) throw new RateLimited(result.retryAfterSeconds);
    },
  };
}
