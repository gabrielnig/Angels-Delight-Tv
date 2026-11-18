import 'server-only';
import { Conflict } from '@ad/shared';
import type { Readable } from 'node:stream';
import { adminDataMode } from './mode';
import type { ExportKind, ExportRequest } from './exports-rules';
import type { AdminActor } from './types';

export interface ExportDto {
  id: string;
  kind: ExportKind;
  name: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  rows: number | null;
  bytes: number | null;
  askedAt: string;
  expiresAt: string | null;
  error: string | null;
}

export interface ExportsService {
  request(actor: AdminActor, request: ExportRequest): Promise<{ id: string }>;
  list(actor: AdminActor): Promise<ExportDto[]>;
  open(
    actor: AdminActor,
    id: string,
  ): Promise<{ stream: Readable; fileName: string; bytes: number }>;
}

/**
 * Background exports need the database, the worker and the private bucket, so there is no fixture version:
 * with fixture data the list is empty and asking for one says why. Small exports still download in the request.
 */
export const exportsAdmin: ExportsService = {
  async request(actor, request) {
    if (adminDataMode() !== 'real')
      throw new Conflict('Background exports need the real database.');
    return (await import('./real/exports')).realExports.request(actor, request);
  },
  async list(actor) {
    if (adminDataMode() !== 'real') return [];
    return (await import('./real/exports')).realExports.list(actor);
  },
  async open(actor, id) {
    if (adminDataMode() !== 'real')
      throw new Conflict('Background exports need the real database.');
    return (await import('./real/exports')).realExports.open(actor, id);
  },
};
