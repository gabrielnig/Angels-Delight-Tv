/** ?t=90 starts at 90 seconds. Anything else is ignored. */
export function parseStartAt(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,6}$/.test(raw)) return null;
  return Number(raw);
}
