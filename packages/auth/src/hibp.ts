import { createHash } from 'node:crypto';

export interface HibpOptions {
  fetch?: (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;
  timeoutMs?: number;
  onUnavailable?: (error: unknown) => void;
}

/**
 * Breached password check with k-anonymity: only the first five characters of the SHA-1 leave the server.
 * If the service is slow or down the answer is "not breached" and the caller logs it. That is the deliberate,
 * documented fallback in SECURITY.md section 4.
 */
export async function isPasswordBreached(
  password: string,
  options: HibpOptions = {},
): Promise<boolean> {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const doFetch = options.fetch ?? ((url, init) => fetch(url, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 2000);
  try {
    const response = await doFetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HIBP answered ${response.status}`);
    const body = await response.text();
    return body.split(/\r?\n/).some((line) => {
      const [candidate, count] = line.split(':');
      return candidate?.trim() === suffix && Number(count) > 0;
    });
  } catch (error) {
    options.onUnavailable?.(error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
