import type { DurationBucket } from '@ad/catalog';
import { AVATAR_IDS, type ProfileDto, type TitleCardDto } from '@ad/viewer';
import type { BrowseLength, CatalogItem, Profile } from '../../lib/data/types';
import { toThumb } from '../../lib/media/to-thumb';

export { toThumb };

/** Pure conversions between the lane C DTOs and the shapes the viewer pages use. No I/O here. */

const TONES = ['sky', 'mint', 'lemon', 'peach', 'lavender'] as const;

/** Cards carry the first visible category and the publish date. A title with no category gets empty strings. */
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
    | 'categorySlug'
    | 'categoryName'
    | 'publishedAt'
  > &
    Partial<Pick<TitleCardDto, 'rating' | 'mostLiked'>>,
): CatalogItem {
  const common = {
    slug: card.slug,
    title: card.title,
    description: card.description ?? '',
    categorySlug: card.categorySlug ?? '',
    categoryName: card.categoryName ?? '',
    thumbnail: toThumb(card.poster),
    hasCaptions: card.hasCaptions,
    kidsSafe: card.kidsSafe,
    publishedAt: card.publishedAt ?? '',
    ...(card.rating !== undefined ? { rating: card.rating } : {}),
    ...(card.mostLiked !== undefined ? { mostLiked: card.mostLiked } : {}),
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
    avatarId: dto.avatarId,
    owner: dto.isPrimary,
    language: dto.language,
    autoplayNext: dto.autoplayNext,
    lastUsedHere: dto.id === activeProfileId,
    hasPin: dto.hasPin,
    dataSaver: dto.dataSaver,
    maxMaturityRank: dto.maxMaturityRank,
  };
}

export function durationBucketOf(length: BrowseLength | undefined): DurationBucket | undefined {
  return length === undefined || length === 'any' ? undefined : length;
}
