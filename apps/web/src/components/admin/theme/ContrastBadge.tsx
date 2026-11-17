import { formatRatio, type ContrastCheck } from '@ad/theme/client';
import { Badge } from '../Badge';

/** Ratio plus a word and an icon, so status never relies on colour alone (DESIGN-SYSTEM 4.2 rule 7). */
export function ContrastBadge({
  check,
  invalid,
  decorative,
}: {
  check?: ContrastCheck;
  invalid?: boolean;
  decorative?: boolean;
}) {
  if (invalid) return <Badge tone="neutral">Not checked</Badge>;
  if (decorative || !check) return <Badge tone="neutral">Decorative</Badge>;
  const ratio = formatRatio(check.ratio);
  if (check.level === 'pass') {
    return (
      <Badge tone="success" icon="check">
        {ratio} Pass
      </Badge>
    );
  }
  if (check.level === 'warn') {
    return (
      <Badge tone="warning" icon="alert">
        {ratio} Low
      </Badge>
    );
  }
  return (
    <Badge tone="danger" icon="alert">
      {ratio} Too low
    </Badge>
  );
}
