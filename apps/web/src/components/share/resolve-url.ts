/** What gets shared: an absolute https address on this site, never the address bar's query or hash. */
export function resolveShareUrl(url: string | undefined): string {
  if (url && /^https?:\/\//.test(url)) return url;
  const path = url && url.startsWith('/') ? url : window.location.pathname;
  return `${window.location.origin}${path}`;
}

