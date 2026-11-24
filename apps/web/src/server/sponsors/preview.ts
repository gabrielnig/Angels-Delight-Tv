import { isStaffRole } from '@ad/shared';

/**
 * True when the request comes from a signed in staff member. Staff clicks on a sponsor card are previews: they
 * go through but are not counted, so checking a card never inflates a sponsor's report. A session that cannot be
 * read is treated as a real viewer.
 */
export async function staffPreview(role: () => Promise<string | null | undefined>): Promise<boolean> {
  try {
    const value = await role();
    return typeof value === 'string' && isStaffRole(value);
  } catch {
    return false;
  }
}
