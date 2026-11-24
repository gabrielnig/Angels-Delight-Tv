/** Keys travel to the client by namespace, the first key segment, so a route sends only what it renders (M46 section 4.3). */
export function pickNamespaces<T>(
  catalog: Record<string, T>,
  namespaces: readonly string[],
  opts: { production?: boolean } = {},
): Record<string, T> {
  const production = opts.production ?? process.env.NODE_ENV === 'production';
  const known = new Set(Object.keys(catalog).map((k) => k.split('.')[0]!));
  const wanted = new Set<string>();
  for (const ns of namespaces) {
    if (known.has(ns)) wanted.add(ns);
    else if (!production) throw new Error(`Unknown message namespace "${ns}"`);
  }
  return Object.fromEntries(Object.entries(catalog).filter(([k]) => wanted.has(k.split('.')[0]!)));
}

/** Namespaces the root layout sends to every client component. Grows with each extraction wave. */
export const CLIENT_NAMESPACES = ['nav', 'kidsExit', 'guest', 'language', 'player', 'browse', 'title', 'mylist', 'home'] as const;
