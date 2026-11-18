import { Resolver } from 'node:dns/promises';
import type { DnsResolver } from './check';

/** The real resolver for the command line. Short timeouts, so a bad network fails fast with a plain message. */
export function nodeResolver(servers?: string[]): DnsResolver {
  const resolver = new Resolver({ timeout: 4000, tries: 2 });
  if (servers && servers.length > 0) resolver.setServers(servers);
  return {
    resolve4: (name) => resolver.resolve4(name),
    resolveTxt: async (name) => (await resolver.resolveTxt(name)).map((chunks) => chunks.join('')),
    resolveCname: (name) => resolver.resolveCname(name),
  };
}
