import { FixtureAccount } from './fixtures/account';
import { FixtureAuth } from './fixtures/auth';
import { FixtureCatalog } from './fixtures/catalog';
import { FixtureLibrary } from './fixtures/library';
import { FixtureProfiles } from './fixtures/profiles';
import { FixtureSite } from './fixtures/site';
import type {
  AccountRepository,
  AuthGateway,
  CatalogRepository,
  LibraryRepository,
  ProfilesRepository,
  SiteRepository,
} from './types';

export * from './types';

/**
 * The one place pages get their data. Today every accessor returns a fixture implementation.
 * The integration pass replaces these returns with the real services from lanes B and C.
 */
const registry = globalThis as unknown as { __adData?: Registry };

interface Registry {
  catalog: CatalogRepository;
  library: LibraryRepository;
  profiles: ProfilesRepository;
  auth: AuthGateway;
  account: AccountRepository;
  site: SiteRepository;
}

function data(): Registry {
  return (registry.__adData ??= {
    catalog: new FixtureCatalog(),
    library: new FixtureLibrary(),
    profiles: new FixtureProfiles(),
    auth: new FixtureAuth(),
    account: new FixtureAccount(),
    site: new FixtureSite(),
  });
}

export const getCatalog = () => data().catalog;
export const getLibrary = () => data().library;
export const getProfiles = () => data().profiles;
export const getAuth = () => data().auth;
export const getAccount = () => data().account;
export const getSite = () => data().site;

/** Tests and the integration pass can replace any part. */
export function setDataForTests(overrides: Partial<Registry>) {
  Object.assign(data(), overrides);
}
