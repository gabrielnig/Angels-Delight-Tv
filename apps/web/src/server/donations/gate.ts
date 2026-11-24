export type DonateGate = 'off' | 'kids' | 'ok';

/** Off wins over everything: with donations off nothing is shown to anyone. Kids never get the form (R25). */
export function decideDonateGate(input: { available: boolean; kids: boolean }): DonateGate {
  if (!input.available) return 'off';
  return input.kids ? 'kids' : 'ok';
}

export const donateLinkVisible = (gate: DonateGate): boolean => gate === 'ok';
