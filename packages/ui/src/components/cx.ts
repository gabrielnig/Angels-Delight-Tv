export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

let counter = 0;
/** Stable enough ids for aria wiring in components that cannot call useId (plain helper). */
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
