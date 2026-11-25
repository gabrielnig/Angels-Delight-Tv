import 'server-only';
import type { Article } from '@ad/help';
import { helpMediaRelease, readVideoText } from './sources';
import { parseVtt, resolveVideoSource, type VttCue } from './video';

/** The caption cues for an article's video, read from the media release. An unreadable file gives an empty transcript. */
export async function videoCues(article: Article): Promise<VttCue[]> {
  const video = article.meta.video;
  if (!video) return [];
  try {
    const text = await readVideoText(
      resolveVideoSource(helpMediaRelease(), video.id, `${video.id}-captions.vtt`),
    );
    return text ? parseVtt(text) : [];
  } catch {
    return [];
  }
}
