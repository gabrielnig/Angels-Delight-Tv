import type { CaptionTrack } from '@ad/player';

interface ApprovedCaptions {
  captions(videoId: string): Promise<Array<{ language: string; label: string; key: string }>>;
}

/** The approved caption tracks a viewer would get for this video, for the staff preview. */
export async function previewCaptionTracks(
  store: ApprovedCaptions,
  mediaOrigin: string,
  videoId: string,
): Promise<CaptionTrack[]> {
  const origin = mediaOrigin.replace(/\/+$/, '');
  return (await store.captions(videoId)).map((track) => ({
    id: track.language,
    language: track.language,
    label: track.label,
    src: `${origin}/${track.key}`,
    status: 'approved' as const,
  }));
}
