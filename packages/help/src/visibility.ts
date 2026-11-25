import type { Article } from './article';
import { roleCanDo, type HelpRole } from './ids';

/**
 * Splits guides by what the person's role can do (M50-S27). Higher role guides are counted, hidden until the person
 * asks to show them, and never blocked: a direct link and search still open them with a role label.
 */
export function splitByRole(
  articles: readonly Article[],
  role: HelpRole,
  options: { showAll?: boolean } = {},
): { visible: Article[]; hidden: Article[]; higher: number } {
  const higher = articles.filter((a) => !roleCanDo(role, a.meta.role));
  if (options.showAll) return { visible: [...articles], hidden: [], higher: higher.length };
  return {
    visible: articles.filter((a) => roleCanDo(role, a.meta.role)),
    hidden: higher,
    higher: higher.length,
  };
}
