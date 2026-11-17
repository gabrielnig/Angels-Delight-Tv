/** Receiver for the CSP `report-uri` directive (L-8). Logs a short allowlisted summary and nothing else. */
const MAX_BYTES = 8 * 1024;
const FIELD_MAX = 120;
const FIELDS = [
  'violated-directive',
  'effective-directive',
  'effectiveDirective',
  'blocked-uri',
  'blockedURL',
  'disposition',
];

/** Keeps the origin of a url, never its path or query, so tokens and addresses in urls are not logged. */
function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.slice(0, FIELD_MAX);
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : url.protocol;
  } catch {
    return /^[\w\s'-]+$/.test(text) ? text : undefined;
  }
}

function summarise(report: unknown): Record<string, string> | null {
  if (!report || typeof report !== 'object') return null;
  const source = report as Record<string, unknown>;
  const inner = (source['csp-report'] ?? source.body ?? source) as Record<string, unknown>;
  if (!inner || typeof inner !== 'object') return null;
  const out: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = clean(inner[field]);
    if (value) out[field] = value;
  }
  return Object.keys(out).length ? out : null;
}

export async function handleCspReport(
  request: Request,
  log: (entry: Record<string, unknown>) => void,
): Promise<Response> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) return new Response(null, { status: 413 });
  const type = request.headers.get('content-type') ?? '';
  if (!/application\/(csp-report|reports\+json|json)/.test(type))
    return new Response(null, { status: 204 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return new Response(null, { status: 413 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  const summary = summarise(first);
  if (summary) log({ csp: summary });
  return new Response(null, { status: 204 });
}
