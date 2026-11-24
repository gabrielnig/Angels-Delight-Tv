/** Picture in picture for Chromium and desktop Safari (standard API) and iOS Safari (webkit presentation mode). */

interface WebkitPip {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
}

type PipVideo = HTMLVideoElement & WebkitPip;
type PipDocument = Document & {
  pictureInPictureEnabled?: boolean;
  pictureInPictureElement?: Element | null;
};

export function pipSupported(video: HTMLVideoElement | null, doc: Document): boolean {
  if ((doc as PipDocument).pictureInPictureEnabled) return true;
  const v = video as PipVideo | null;
  return (
    typeof v?.webkitSetPresentationMode === 'function' &&
    v.webkitSupportsPresentationMode?.('picture-in-picture') === true
  );
}

export function inPip(video: HTMLVideoElement | null, doc: Document): boolean {
  const v = video as PipVideo | null;
  if (v?.webkitPresentationMode === 'picture-in-picture') return true;
  return Boolean(video) && (doc as PipDocument).pictureInPictureElement === video;
}

/** Opens or closes the small window. Throws when the browser refuses, so the caller can say so. */
export async function togglePip(video: HTMLVideoElement | null, doc: Document): Promise<void> {
  const v = video as PipVideo | null;
  if (!v) return;
  if (inPip(v, doc)) {
    if (v.webkitPresentationMode === 'picture-in-picture' && v.webkitSetPresentationMode) {
      v.webkitSetPresentationMode('inline');
    } else {
      await doc.exitPictureInPicture();
    }
    return;
  }
  if (
    typeof v.requestPictureInPicture === 'function' &&
    (doc as PipDocument).pictureInPictureEnabled
  ) {
    await v.requestPictureInPicture();
  } else if (v.webkitSetPresentationMode) {
    v.webkitSetPresentationMode('picture-in-picture');
  } else {
    throw new Error('no picture in picture');
  }
}

/** Calls back with the new state whenever the video enters or leaves the small window. */
export function watchPip(
  video: HTMLVideoElement | null,
  doc: Document,
  onChange: (active: boolean) => void,
): () => void {
  if (!video) return () => undefined;
  const handler = () => onChange(inPip(video, doc));
  const events = [
    'enterpictureinpicture',
    'leavepictureinpicture',
    'webkitpresentationmodechanged',
  ];
  for (const e of events) video.addEventListener(e, handler);
  return () => {
    for (const e of events) video.removeEventListener(e, handler);
  };
}
