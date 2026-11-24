import { verifyUnsubscribeToken } from '@ad/queue';

export interface UnsubscribeDeps {
  kek: Uint8Array;
  now(): Date;
  /** Turns the digest off for an account. False when the account had no settings, which is not an error. */
  unsubscribe(accountId: string): Promise<boolean>;
}

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'no-referrer',
} as const;

function page(status: number, title: string, line: string): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.5rem">${title}</h1><p>${line}</p><p><a href="/">Go to the home page</a></p></body></html>`;
  return new Response(body, { status, headers: HEADERS });
}

/**
 * The link in every digest email (M44-S15 AC3). The signed token is the only credential and opens this one door:
 * it switches the email off for one account. No sign in. GET is the link, POST is the List-Unsubscribe-Post
 * one click used by mail apps. The answer is the same whether or not the account had settings.
 */
export async function handleUnsubscribe(request: Request, deps: UnsubscribeDeps): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const accountId = token ? verifyUnsubscribeToken(deps.kek, token, deps.now()) : null;
  if (!accountId) {
    return page(400, 'This link is not valid', 'This link is not valid or has expired. Sign in and open your account notification settings to change your email choice.');
  }
  try {
    await deps.unsubscribe(accountId);
  } catch {
    return page(500, 'We could not finish', 'Something went wrong on our side. Try the link again in a few minutes.');
  }
  return page(200, 'You are unsubscribed', 'We will not send you this notification email again. You can turn it back on any time in your account notification settings.');
}
