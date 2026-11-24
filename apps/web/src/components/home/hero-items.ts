import type { HeroItem } from '@ad/ui';
import type { HomeData, Progress } from '../../lib/data';
import { itemHref, metaLine, timeLeftLabel } from '../../lib/format';

/** Maps the Home hero slots to the slides the Hero draws. The wide artwork rides on the item thumbnail (M41-S01). */
export function heroItems(home: HomeData, progress: Map<string, Progress>): HeroItem[] {
  return home.hero.map(({ item, blurb, headline, buttonLabel, previewUrl }) => {
    const video = item.kind === 'video' ? item : null;
    const resume = video ? progress.get(video.id) : undefined;
    const wide = item.thumbnail;
    return {
      id: item.kind === 'video' ? item.id : item.slug,
      title: headline ?? item.title,
      description: blurb ?? item.description,
      image: wide ? { src: wide.src, srcSet: wide.srcSet, alt: wide.alt ?? '' } : undefined,
      meta: metaLine(item),
      playHref: video
        ? `/watch/${video.id}${resume ? `?t=${Math.floor(resume.positionSeconds)}` : ''}`
        : itemHref(item),
      infoHref: itemHref(item),
      playLabel: buttonLabel,
      previewSrc: previewUrl,
      resumeLabel:
        resume && resume.positionSeconds < resume.durationSeconds * 0.95
          ? timeLeftLabel(resume)
          : undefined,
    };
  });
}
