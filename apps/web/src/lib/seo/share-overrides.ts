import type { PublicPreview } from '../data/types';
import { cleanText, trimWords } from './metadata';

/** The editor's own words for a share card (L15b). Pure, so the admin form and the server agree. */

export const SHARE_TITLE_MAX = 90;
export const SHARE_DESCRIPTION_MAX = 200;

export interface ShareTextInput {
  title?: string;
  description?: string;
}

export type ShareTextResult =
  | { ok: true; value: { shareTitle?: string | null; shareDescription?: string | null } }
  | { ok: false; errors: Record<string, string> };

const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]');

function field(raw: string, max: number, label: string): { value: string | null } | { error: string } {
  const text = raw.trim();
  if (CONTROL.test(text)) return { error: `Remove the hidden characters from the ${label}.` };
  if (/[<>]/.test(text)) return { error: `Remove the < and > signs from the ${label}.` };
  if (text.length > max) return { error: `Keep the ${label} under ${max + 1} characters (${max} at most).` };
  return { value: text === '' ? null : text };
}

export function validateShareText(input: ShareTextInput): ShareTextResult {
  const value: { shareTitle?: string | null; shareDescription?: string | null } = {};
  const errors: Record<string, string> = {};
  if (input.title !== undefined) {
    const r = field(input.title, SHARE_TITLE_MAX, 'share title');
    if ('error' in r) errors.title = r.error;
    else value.shareTitle = r.value;
  }
  if (input.description !== undefined) {
    const r = field(input.description, SHARE_DESCRIPTION_MAX, 'share description');
    if ('error' in r) errors.description = r.error;
    else value.shareDescription = r.value;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/** The share words of a public preview, absent for a redirect or when none are set. */
export function shareOf(
  preview: PublicPreview | null | undefined,
): { title?: string | null; description?: string | null } | undefined {
  return preview && preview.type !== 'redirect' ? preview.share : undefined;
}

/** The words a card shows: the share words when set, else the title and description. */
export function shareTextOf(
  base: { title: string; description: string },
  share: { title?: string | null; description?: string | null } | undefined,
): { title: string; description: string } {
  return {
    title: share?.title?.trim() || base.title,
    description: share?.description?.trim() || base.description,
  };
}

export type PreviewPlatform = 'whatsapp' | 'facebook' | 'x';

/** Roughly how many characters each app shows before it cuts. Approximations from public documentation and use. */
export const PLATFORM_LIMITS: Record<PreviewPlatform, { title: number; description: number }> = {
  whatsapp: { title: 65, description: 120 },
  facebook: { title: 88, description: 160 },
  x: { title: 70, description: 200 },
};

export interface PreviewCard {
  platform: PreviewPlatform;
  title: string;
  description: string;
  domain: string;
  imageUrl: string | null;
  cut: { title: boolean; description: boolean };
}

export function previewCards(input: {
  title: string;
  description: string;
  siteName: string;
  origin: string | undefined;
  imageUrl: string | null;
}): PreviewCard[] {
  const title = cleanText(input.title);
  const description = cleanText(input.description);
  let domain = input.siteName;
  let imageUrl = input.imageUrl;
  if (input.origin) {
    try {
      const base = new URL(input.origin);
      domain = base.host;
      if (imageUrl) imageUrl = new URL(imageUrl, base).toString();
    } catch {
      // A bad origin leaves the site name as the domain.
    }
  }
  return (['whatsapp', 'facebook', 'x'] as const).map((platform) => {
    const limit = PLATFORM_LIMITS[platform];
    const shownTitle = trimWords(title, limit.title);
    const shownDescription = trimWords(description, limit.description);
    return {
      platform,
      title: shownTitle,
      description: shownDescription,
      domain,
      imageUrl,
      cut: { title: shownTitle !== title, description: shownDescription !== description },
    };
  });
}
