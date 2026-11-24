import { isStaffRole, type AccountRole } from '@ad/shared';

/**
 * The account linking decision for Google sign in (M49-S05, S06, decision D-L10-03). Pure, so every rule is a
 * table test. The caller gathers the facts, this function only decides.
 */
export interface LinkAccountFacts {
  id: string;
  role: string;
  status: string;
  /** `email_verified_at` is set. */
  verified: boolean;
  hasPassword: boolean;
}

export interface LinkFacts {
  /** Google's `email_verified` claim, true only when it was exactly true. */
  emailVerified: boolean;
  /** The account that owns `(google, sub)`, when there is one. */
  identity: { account: LinkAccountFacts } | null;
  /** The account that has the same address, when there is one. */
  account: LinkAccountFacts | null;
}

export type LinkRefusal = 'unverified_email' | 'staff' | 'unavailable';

export type LinkDecision =
  | { action: 'refuse'; reason: LinkRefusal }
  | { action: 'sign_in'; accountId: string }
  | { action: 'create' }
  /** `password` asks for the account password once. `reset` means the account has none, so a reset comes first. */
  | { action: 'confirm_link'; accountId: string; proof: 'password' | 'reset' }
  | { action: 'adopt'; accountId: string };

/** A purged account keeps no address, so for linking it is as if it never existed. */
const isGone = (account: LinkAccountFacts | null | undefined): boolean =>
  !account || account.status === 'deleted';

export function decideLink(facts: LinkFacts): LinkDecision {
  // 1. Without a verified address nothing is touched, whatever else is true.
  if (!facts.emailVerified) return { action: 'refuse', reason: 'unverified_email' };

  // 2. The identity is the key. A new address at Google does not move it.
  if (!isGone(facts.identity?.account)) {
    const owner = facts.identity!.account;
    if (isStaffRole(owner.role as AccountRole)) return { action: 'refuse', reason: 'staff' };
    if (owner.status === 'pending_deletion') return { action: 'sign_in', accountId: owner.id };
    if (owner.status !== 'active') return { action: 'refuse', reason: 'unavailable' };
    return { action: 'sign_in', accountId: owner.id };
  }

  const account = facts.account;
  // 3. Nobody has this address: a new verified account.
  if (isGone(account)) return { action: 'create' };
  const found = account!;

  // 6. Staff never use Google.
  if (isStaffRole(found.role as AccountRole)) return { action: 'refuse', reason: 'staff' };
  // 7. Suspended or any other state follows the password sign in handling.
  if (found.status !== 'active' && found.status !== 'pending_deletion')
    return { action: 'refuse', reason: 'unavailable' };

  // 5. An unverified account: Google proves the address, so the squatter's password dies with the adoption.
  if (!found.verified) return { action: 'adopt', accountId: found.id };

  // 4. A verified account is never linked silently, so a lookalike Google account cannot take it over.
  return {
    action: 'confirm_link',
    accountId: found.id,
    proof: found.hasPassword ? 'password' : 'reset',
  };
}
