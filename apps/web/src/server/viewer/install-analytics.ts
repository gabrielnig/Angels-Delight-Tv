import 'server-only';
import { setViewerResolver } from '../../lib/data/analytics-viewer';
import { realDataEnabled } from '../data/mode';
import { createRealViewerResolver } from './analytics-identity';
import { viewerRuntime } from './runtime';

let installed = false;

/** Points the analytics route at the real session and active profile. Does nothing in fixture mode. Safe to call per request. */
export function installRealViewerResolver(): void {
  if (installed || !realDataEnabled()) return;
  installed = true;
  setViewerResolver(createRealViewerResolver(viewerRuntime()));
}
