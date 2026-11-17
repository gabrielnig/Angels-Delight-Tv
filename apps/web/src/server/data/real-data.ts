import 'server-only';
import { hmacSha256 } from '@ad/shared';
import { viewerRuntime } from '../viewer/runtime';
import { cookieProfileIo } from './profile-io';
import { AccountViewerData } from './real-account-data';
import { RealCatalog } from './real-catalog';
import { RealLibrary } from './real-library';
import { RealProfiles } from './real-profiles';

export const createRealCatalog = () => new RealCatalog(viewerRuntime().ctx);
export const createRealLibrary = () => new RealLibrary(viewerRuntime().ctx);
export const createRealProfiles = () => new RealProfiles(viewerRuntime().ctx, cookieProfileIo());

const LABEL = new TextEncoder().encode('ad:account-export-key:v1');
let viewerData: AccountViewerData | undefined;

/** Stats, playback settings and the data export for the account area. One per process. */
export function accountViewerData(): AccountViewerData {
  viewerData ??= new AccountViewerData(viewerRuntime().ctx, {
    exportSecret: hmacSha256(viewerRuntime().profileSecret, LABEL),
  });
  return viewerData;
}
