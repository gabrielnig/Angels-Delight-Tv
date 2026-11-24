import { z } from 'zod';

/**
 * Request shapes for the viewer API. Routes parse with these before calling a service, and the UI lanes can
 * import the same schemas for form validation. Services still validate again, these only shape the wire format.
 */
const id = z.string().min(1).max(64);
const cursor = z.string().min(1).max(600);

export const profileIdQuery = z.object({ profileId: id });

export const createProfileBody = z.object({
  name: z.string().max(80),
  avatarId: z.string().max(32),
  isKids: z.boolean().optional(),
  language: z.string().min(2).max(10).optional(),
  autoplayNext: z.boolean().optional(),
  dataSaver: z.boolean().optional(),
});

export const updateProfileBody = createProfileBody.partial().extend({
  maxMaturityRank: z.number().int().min(0).max(4).optional(),
  pin: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
  password: z.string().max(256).optional(),
  expectedUpdatedAt: z.string().max(40).optional(),
});

export const selectProfileBody = z.object({ pin: z.string().max(8).optional() });
export const exitKidsBody = z.object({ password: z.string().min(1).max(256) });

export const homeQuery = profileIdQuery.extend({ cursor: cursor.optional() });

export const browseQuery = profileIdQuery.extend({
  category: z.string().max(80).optional(),
  sort: z.enum(['newest', 'az', 'shortest', 'longest']).optional(),
  duration: z.enum(['short', 'medium', 'long']).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  cursor: cursor.optional(),
});

export const searchQuery = profileIdQuery.extend({
  q: z.string().max(400),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  cursor: cursor.optional(),
  record: z
    .enum(['1', '0', 'true', 'false'])
    .transform((v) => v === '1' || v === 'true')
    .optional(),
  exact: z
    .enum(['1', '0', 'true', 'false'])
    .transform((v) => v === '1' || v === 'true')
    .optional(),
});

export const suggestQuery = profileIdQuery.extend({ q: z.string().max(400) });

export const recentSearchDelete = profileIdQuery.extend({ q: z.string().max(400).optional() });

export const titleDetailQuery = profileIdQuery.extend({
  kind: z.enum(['video', 'series']).optional(),
});

export const titleRef = z.object({ kind: z.enum(['video', 'series']), id });

export const saveProgressBody = z.object({
  profileId: id,
  videoId: id,
  positionMs: z.number().int().min(0).max(86_400_000),
  clientTimestamp: z.string().max(40).optional(),
  seek: z.boolean().optional(),
  ended: z.boolean().optional(),
});

export const importProgressBody = z.object({
  profileId: id,
  items: z
    .array(
      z.object({
        videoId: z.string().max(40),
        positionMs: z.number().min(0).max(86_400_000),
        finished: z.boolean(),
        updatedAt: z.number().min(0).max(8_640_000_000_000_000),
      }),
    )
    .max(100),
});

export const progressQuery = profileIdQuery.extend({ videoId: id.optional() });
export const removeProgressBody = z.object({ profileId: id, videoId: id });

export const myListQuery = profileIdQuery.extend({
  limit: z.coerce.number().int().min(1).max(60).optional(),
  cursor: cursor.optional(),
});
export const myListAddBody = z.object({
  profileId: id,
  target: titleRef,
  restoreAddedAt: z.string().max(40).optional(),
});
export const ratingBody = z.object({
  profileId: id,
  target: titleRef,
  /** -1 Not for me, 1 Like, 2 Love, null clears. */
  value: z.union([z.literal(-1), z.literal(1), z.literal(2), z.null()]),
});
export const ratingQuery = profileIdQuery.extend({
  kind: z.enum(['video', 'series']),
  id,
});
export const myListRemoveBody = z.object({ profileId: id, target: titleRef });

/**
 * Guest (account free) query shapes for the public GETs (M40). They have no `profileId` and zod drops unknown
 * keys, so a `profileId` or `record` value a caller sends on the guest path is ignored, never read.
 */
export const guestHomeQuery = z.object({ cursor: cursor.optional() });
export const guestBrowseQuery = browseQuery.omit({ profileId: true });
export const guestSearchQuery = searchQuery.omit({ profileId: true });
export const guestSuggestQuery = z.object({ q: z.string().max(400) });
export const guestTitleQuery = titleDetailQuery.omit({ profileId: true });
/** Comma separated ids, at most 20 (the service refuses more). */
export const titlesBatchQuery = z.object({
  ids: z
    .string()
    .min(1)
    .max(20 * 37 + 40),
});
