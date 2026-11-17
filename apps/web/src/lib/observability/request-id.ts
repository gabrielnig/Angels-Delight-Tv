import { base32Random } from '@ad/shared';

export const REQUEST_ID_HEADER = 'x-request-id';
const VALID = /^[A-Za-z0-9_-]{8,64}$/;

export function newRequestId(): string {
  return `req_${base32Random(10)}`;
}

/** Keeps a well formed inbound id (from the proxy) so one id traces the whole request, otherwise makes one. */
export function requestIdFrom(headers: Headers): string {
  const inbound = headers.get(REQUEST_ID_HEADER);
  return inbound && VALID.test(inbound) ? inbound : newRequestId();
}
