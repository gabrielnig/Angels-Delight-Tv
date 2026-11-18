/** Alias of /api/ready: database, storage and queue checks, 503 when any fails. */
export const dynamic = 'force-dynamic';
export { GET } from '../api/ready/route';
