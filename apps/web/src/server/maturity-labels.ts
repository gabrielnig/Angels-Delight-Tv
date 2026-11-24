import 'server-only';
import { parseMaturityLabels } from '@ad/shared';
import { themeRuntime } from '../lib/data/admin/theme-runtime';

/** The five labels of `maturity.labels`, or null so every screen keeps the defaults (R20). Never throws. */
export async function maturityLabelsSetting(): Promise<string[] | null> {
  try {
    return parseMaturityLabels(await (await themeRuntime()).settings.get('maturity.labels'));
  } catch {
    return null;
  }
}
