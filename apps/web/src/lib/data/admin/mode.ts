type Env = Record<string, string | undefined>;

/**
 * Where admin data comes from (D-072). Real services are the default everywhere except unit tests.
 * `ADMIN_DATA=fixture` opts in to in memory fixtures for UI work and demos. Production never serves fixtures,
 * and asking for them there is an error rather than a silent fallback.
 */
export function adminDataMode(env: Env = process.env): 'fixture' | 'real' {
  const production = env.NODE_ENV === 'production';
  if (env.ADMIN_DATA === 'fixture') {
    if (production) throw new Error('Admin fixture data is not available in production.');
    return 'fixture';
  }
  if (env.ADMIN_DATA === 'real') return 'real';
  return env.NODE_ENV === 'test' ? 'fixture' : 'real';
}

export function fixtureDataAllowed(env: Env = process.env): boolean {
  return env.NODE_ENV !== 'production';
}

/**
 * One service object that picks its implementation per call. The real implementation is imported on first use,
 * so fixture runs and unit tests never load database code.
 */
export function delegating<T extends object>(fixture: T, real: () => Promise<T>): T {
  let loaded: Promise<T> | undefined;
  return new Proxy({} as T, {
    get(_target, key) {
      return async (...args: unknown[]) => {
        const impl = adminDataMode() === 'real' ? await (loaded ??= real()) : fixture;
        const method = (impl as Record<string | symbol, unknown>)[key];
        if (typeof method !== 'function')
          throw new Error(`Unknown admin service call ${String(key)}`);
        return (method as (...a: unknown[]) => unknown).apply(impl, args);
      };
    },
  });
}
