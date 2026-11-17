import { createRealAccount, createRealAuth } from '../../server/auth/real-data';
import { realAuthEnabled } from '../../server/auth/mode';
import { realDataEnabled } from '../../server/data/mode';
import {
  accountViewerData,
  createRealCatalog,
  createRealLibrary,
  createRealProfiles,
} from '../../server/data/real-data';
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
 * The one place pages get their data. Real services (lanes B and C) when `realDataEnabled()`, the lane E
 * fixtures otherwise. Fixtures are for local UI work and tests only: production is always real and
 * `VIEWER_FIXTURES=on` is ignored there (server/data/mode.ts). Site content is still a fixture (lane H settings).
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
  if (registry.__adData) return registry.__adData;
  const real = realDataEnabled();
  return (registry.__adData = {
    catalog: real ? createRealCatalog() : new FixtureCatalog(),
    library: real ? createRealLibrary() : new FixtureLibrary(),
    profiles: real ? createRealProfiles() : new FixtureProfiles(),
    auth: realAuthEnabled() ? createRealAuth() : new FixtureAuth(),
    account: realAuthEnabled()
      ? createRealAccount(real ? accountViewerData() : undefined)
      : new FixtureAccount(),
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
