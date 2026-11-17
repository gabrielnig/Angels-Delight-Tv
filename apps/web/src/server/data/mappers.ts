import type { ArtworkDto, DurationBucket } from '@ad/catalog';
import { AVATAR_IDS, type ProfileDto, type TitleCardDto } from '@ad/viewer';
import type { BrowseLength, CatalogItem, Profile, Thumb } from '../../lib/data/types';

/** Pure conversions between the lane C DTOs and the shapes the viewer pages use. No I/O here. */

const PREFERRED_WIDTH = 480;
const TONES = ['sky', 'mint', 'lemon', 'peach', 'lavender'] as const;

export function toThumb(poster: ArtworkDto | null): Thumb | undefined {
  const variants = poster?.variants ?? [];
  if (variants.length === 0) return undefined;
  const chosen = variants.find((v) => v.width >= PREFERRED_WIDTH) ?? variants[variants.length - 1]!;
  return {
    src: chosen.url,
    srcSet: variants.map((v) => `${v.url} ${v.width}w`).join(', '),
  };
}

/**
 * Cards carry no category and no publish date, so those fields stay empty. Screens that need a category
 * (title and series pages) read it from the detail DTO instead.
 */
export function cardToItem(
  card: Pick<
    TitleCardDto,
    | 'kind'
    | 'id'
    | 'slug'
    | 'title'
    | 'description'
    | 'durationMs'
    | 'episodeCount'
    | 'kidsSafe'
    | 'hasCaptions'
    | 'poster'
  >,
): CatalogItem {
  const common = {
    slug: card.slug,
    title: card.title,
    description: card.description ?? '',
    categorySlug: '',
    categoryName: '',
    thumbnail: toThumb(card.poster),
    hasCaptions: card.hasCaptions,
    kidsSafe: card.kidsSafe,
    publishedAt: '',
  };
  if (card.kind === 'series') {
    return {
      kind: 'series',
      id: card.id,
      ...common,
      episodeCount: card.episodeCount ?? 0,
      seasonCount: 1,
    };
  }
  return {
    kind: 'video',
    id: card.id,
    ...common,
    durationSeconds: Math.round((card.durationMs ?? 0) / 1000),
  };
}

export function toneFromAvatar(avatarId: string): string {
  const index = (AVATAR_IDS as readonly string[]).indexOf(avatarId);
  return TONES[(index < 0 ? 0 : index) % TONES.length]!;
}

export function avatarFromTone(tone: string | undefined): (typeof AVATAR_IDS)[number] {
  const index = TONES.indexOf(tone as (typeof TONES)[number]);
  return AVATAR_IDS[index < 0 ? 0 : index]!;
}

export function profileToView(dto: ProfileDto, activeProfileId?: string | null): Profile {
  return {
    id: dto.id,
    name: dto.name,
    kids: dto.isKids,
    tone: toneFromAvatar(dto.avatarId),
    owner: dto.isPrimary,
    language: dto.language,
    autoplayNext: dto.autoplayNext,
    lastUsedHere: dto.id === activeProfileId,
  };
}

export function durationBucketOf(length: BrowseLength | undefined): DurationBucket | undefined {
  return length === undefined || length === 'any' ? undefined : length;
}
