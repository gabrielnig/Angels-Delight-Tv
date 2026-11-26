/** Lowest to highest, as the code defines them (packages/shared/src/enums.ts). */
export const ROLE_ORDER = ['editor', 'admin', 'super_admin'];

/**
 * Mixed guides keep the lowest role in front matter (a test enforces it) and name the higher parts in roleNote. The
 * checker follows every step, so it runs these as the role that can do the whole guide.
 */
export const FACT_ROLE_OVERRIDES: Record<string, string> = {
  K10: 'admin',
  C10: 'super_admin',
  C14: 'super_admin',
};
